// Server-only module: expected payments ("cobros esperados", PRD section 17).
import { getConnector } from '@/lib/payments/connectors';
import type { ExpectedPayment, Provider } from '@/lib/payments/types';
import { toConnection, toExpectedPayment, CONNECTION_COLUMNS, type ConnectionRow } from '@/lib/server/paymentsRepository';
import { ScopeError, type ResolvedScope } from '@/lib/server/scope';
import { getServiceClient } from '@/lib/server/session';

const COLUMNS =
  'id, business_id, store_id, amount, currency, reference, status, created_at, expires_at, provider, provider_order_id, checkout_url, matched_transaction_id, match_score, matched_at';

export interface CreateExpectedPaymentInput {
  amount: number;
  currency?: string;
  reference?: string | null;
  /** Minutes until the charge expires. Default 15, max 24h. */
  expiresInMinutes?: number;
  /** Optional connection to create a provider charge (Ualá checkout link). */
  connectionId?: string | null;
}

export type ExpectedPaymentView = ExpectedPayment & {
  matchedTransactionId: string | null;
  matchedAt: string | null;
};

type Row = Parameters<typeof toExpectedPayment>[0] & {
  matched_transaction_id: string | null;
  matched_at: string | null;
};

function toView(row: Row): ExpectedPaymentView {
  return { ...toExpectedPayment(row), matchedTransactionId: row.matched_transaction_id, matchedAt: row.matched_at };
}

/** Marks WAITING rows past their deadline as EXPIRED (cheap, called on read). */
async function expireStale(businessId: string): Promise<void> {
  await getServiceClient()
    .from('expected_payments')
    .update({ status: 'EXPIRED' })
    .eq('business_id', businessId)
    .eq('status', 'WAITING')
    .lt('expires_at', new Date().toISOString());
}

export async function listExpectedPayments(scope: ResolvedScope, status?: string | null): Promise<ExpectedPaymentView[]> {
  await expireStale(scope.businessId);
  let query = getServiceClient()
    .from('expected_payments')
    .select(COLUMNS)
    .eq('business_id', scope.businessId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (scope.storeId) query = query.eq('store_id', scope.storeId);
  if (status) query = query.eq('status', status);
  const { data, error } = await query.returns<Row[]>();
  if (error) throw error;
  return (data ?? []).map(toView);
}

export async function getExpectedPayment(scope: ResolvedScope, id: string): Promise<ExpectedPaymentView> {
  await expireStale(scope.businessId);
  let query = getServiceClient().from('expected_payments').select(COLUMNS).eq('id', id).eq('business_id', scope.businessId);
  if (scope.storeId) query = query.eq('store_id', scope.storeId);
  const { data, error } = await query.maybeSingle<Row>();
  if (error) throw error;
  if (!data) throw new ScopeError('Cobro no encontrado', 403);
  return toView(data);
}

export async function createExpectedPayment(
  scope: ResolvedScope,
  userId: string,
  input: CreateExpectedPaymentInput,
  urls: { origin: string },
): Promise<ExpectedPaymentView> {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) {
    throw new ScopeError('Monto inválido', 400);
  }
  const minutes = Math.min(Math.max(Number(input.expiresInMinutes) || 15, 1), 24 * 60);
  const db = getServiceClient();

  let connectionRow: ConnectionRow | null = null;
  if (input.connectionId) {
    const { data } = await db
      .from('payment_connections')
      .select(CONNECTION_COLUMNS)
      .eq('id', input.connectionId)
      .eq('business_id', scope.businessId)
      .neq('status', 'DISCONNECTED')
      .maybeSingle<ConnectionRow>();
    if (!data) throw new ScopeError('Integración no encontrada', 403);
    if (scope.storeId && data.store_id && data.store_id !== scope.storeId) {
      throw new ScopeError('La integración pertenece a otra tienda', 403);
    }
    connectionRow = data;
  }

  const { data: created, error } = await db
    .from('expected_payments')
    .insert({
      business_id: scope.businessId,
      store_id: scope.storeId,
      created_by: userId,
      amount: Math.round(amount * 100) / 100,
      currency: (input.currency || 'ARS').toUpperCase(),
      reference: input.reference?.toString().slice(0, 120) || null,
      expires_at: new Date(Date.now() + minutes * 60_000).toISOString(),
      provider: (connectionRow?.provider as Provider | undefined) ?? null,
      connection_id: connectionRow?.id ?? null,
    })
    .select(COLUMNS)
    .single<Row>();
  if (error) throw error;

  await db.from('audit_logs').insert({
    business_id: scope.businessId,
    user_id: userId,
    action: 'EXPECTED_PAYMENT_CREATED',
    entity_type: 'expected_payment',
    entity_id: created.id,
    new_data: { amount: created.amount, store_id: created.store_id, provider: created.provider },
  });

  if (connectionRow) {
    const connector = getConnector(connectionRow.provider);
    if (connector.createCharge) {
      try {
        const charge = await connector.createCharge(toConnection(connectionRow), {
          expectedPaymentId: created.id,
          amount: Number(created.amount),
          currency: created.currency,
          description: created.reference || 'Cobro PayAlert',
          notificationUrl: `${urls.origin}/api/webhooks/${connectionRow.provider === 'uala' ? 'uala' : 'mercadopago'}`,
          successUrl: `${urls.origin}/dashboard/terminal?cobro=${created.id}`,
          failureUrl: `${urls.origin}/dashboard/terminal?cobro=${created.id}&error=1`,
        });
        const { data: updated, error: updateError } = await db
          .from('expected_payments')
          .update({ provider_order_id: charge.providerOrderId, checkout_url: charge.checkoutUrl })
          .eq('id', created.id)
          .select(COLUMNS)
          .single<Row>();
        if (updateError) throw updateError;
        return toView(updated);
      } catch (chargeError) {
        await db.from('expected_payments').update({ status: 'CANCELLED' }).eq('id', created.id);
        console.error('[expected-payments] charge creation failed:', chargeError instanceof Error ? chargeError.message : 'unknown');
        throw new ScopeError('No pudimos generar el link de cobro con el proveedor. Probá de nuevo.', 400);
      }
    }
  }
  return toView(created);
}

/**
 * Manual resolution: cancel, or confirm a MANUAL_REVIEW/WAITING charge against a stored transaction
 * of the same business (PRD: "match manual" is audited).
 */
export async function updateExpectedPayment(
  scope: ResolvedScope,
  userId: string,
  id: string,
  action: { type: 'cancel' } | { type: 'match'; transactionId: string },
): Promise<ExpectedPaymentView> {
  const current = await getExpectedPayment(scope, id);
  const db = getServiceClient();

  if (action.type === 'cancel') {
    if (!['WAITING', 'MANUAL_REVIEW'].includes(current.status)) {
      throw new ScopeError('Solo se pueden cancelar cobros pendientes', 400);
    }
    await db.from('expected_payments').update({ status: 'CANCELLED' }).eq('id', id).eq('business_id', scope.businessId);
  } else {
    if (!['WAITING', 'MANUAL_REVIEW'].includes(current.status)) {
      throw new ScopeError('El cobro ya está resuelto', 400);
    }
    const { data: tx } = await db
      .from('transactions')
      .select('id, provider_status, expected_payment_id')
      .eq('id', action.transactionId)
      .eq('business_id', scope.businessId)
      .maybeSingle<{ id: string; provider_status: string | null; expected_payment_id: string | null }>();
    if (!tx) throw new ScopeError('Movimiento no encontrado', 403);
    if (tx.provider_status !== 'CONFIRMED') throw new ScopeError('El movimiento no está acreditado', 400);
    if (tx.expected_payment_id && tx.expected_payment_id !== id) {
      throw new ScopeError('Ese movimiento ya está asignado a otro cobro', 400);
    }
    const { error } = await db
      .from('expected_payments')
      .update({ status: 'MATCHED', matched_transaction_id: tx.id, matched_at: new Date().toISOString() })
      .eq('id', id)
      .eq('business_id', scope.businessId);
    if (error) {
      if (error.code === '23505') throw new ScopeError('Ese movimiento ya está asignado a otro cobro', 400);
      throw error;
    }
    await db.from('transactions').update({ expected_payment_id: id }).eq('id', tx.id).eq('business_id', scope.businessId);
    // Other charges waiting on the same transaction go back to WAITING.
    await db
      .from('expected_payments')
      .update({ status: 'WAITING', match_candidates: [] })
      .eq('business_id', scope.businessId)
      .eq('status', 'MANUAL_REVIEW')
      .neq('id', id)
      .contains('match_candidates', [{ transaction_id: tx.id }]);
  }

  await db.from('audit_logs').insert({
    business_id: scope.businessId,
    user_id: userId,
    action: action.type === 'cancel' ? 'EXPECTED_PAYMENT_CANCELLED' : 'EXPECTED_PAYMENT_MANUAL_MATCH',
    entity_type: 'expected_payment',
    entity_id: id,
    new_data: action.type === 'match' ? { transaction_id: action.transactionId } : null,
  });
  return getExpectedPayment(scope, id);
}
