// Server-only module: expected payments ("cobros esperados", PRD section 17).
import { getConnector } from '@/lib/payments/connectors';
import type { ExpectedPayment, Provider, NormalizedTransaction } from '@/lib/payments/types';
import { toConnection, toExpectedPayment, CONNECTION_COLUMNS, type ConnectionRow } from '@/lib/server/paymentsRepository';
import { ScopeError, type ResolvedScope } from '@/lib/server/scope';
import { getServiceClient } from '@/lib/server/session';
import { recordAuditEvent } from '@/lib/server/audit';

const COLUMNS =
  'id, business_id, store_id, amount, currency, reference, status, created_at, expires_at, provider, provider_order_id, checkout_url, matched_transaction_id, match_score, matched_at, match_candidates';

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
  matchScore: number | null;
  matchCandidates: ExpectedPayment['match_candidates'];
};

type Row = Parameters<typeof toExpectedPayment>[0] & {
  matched_transaction_id: string | null;
  matched_at: string | null;
  match_score: number | null;
};

function toView(row: Row): ExpectedPaymentView {
  const expectedPayment = toExpectedPayment(row);
  return { ...expectedPayment, matchedTransactionId: row.matched_transaction_id, matchedAt: row.matched_at,
    matchScore: row.match_score, matchCandidates: expectedPayment.match_candidates };
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

  await recordAuditEvent(db, { businessId: scope.businessId, actorId: userId, action: 'CONFIGURATION_UPDATED', entityType: 'expected_payment', entityId: created.id });

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

export async function dismissExpectedPaymentCandidate(
  scope: ResolvedScope, userId: string, id: string, transactionId: string,
): Promise<void> {
  const db = getServiceClient();
  const { data: candidate, error } = await db.from('expected_payments')
    .select('match_candidates').eq('id', id).eq('business_id', scope.businessId)
    .maybeSingle<{ match_candidates: ExpectedPayment['match_candidates'] }>();
  if (error) throw error;
  if (!candidate) throw new ScopeError('El cobro no tiene candidatos para descartar', 400);
  const matched = candidate.match_candidates.find(item => item.transaction_id === transactionId);
  if (!matched) throw new ScopeError('El candidato no pertenece a este cobro', 400);
  const { data: transaction, error: transactionError } = await db.from('transactions')
    .select('id, amount, currency, metadata').eq('id', transactionId)
    .eq('business_id', scope.businessId).maybeSingle<{ id: string; amount: number; currency: string; metadata: Record<string, unknown> | null }>();
  if (transactionError) throw transactionError;
    if (!transaction) throw new ScopeError('Movimiento no encontrado', 400);
  const remaining = candidate.match_candidates.filter(item => item.transaction_id !== transactionId);
  const { data: updated, error: updateError } = await db.from('expected_payments')
    .update({ match_candidates: remaining, match_score: remaining[0]?.score ?? null,
      status: remaining.length ? 'MANUAL_REVIEW' : 'WAITING' })
    .eq('id', id).eq('business_id', scope.businessId).eq('status', 'MANUAL_REVIEW')
    .contains('match_candidates', [{ transaction_id: transactionId }]).select('id').maybeSingle();
  if (updateError) throw updateError;
  if (!updated) throw new ScopeError('El cobro ya fue resuelto', 400);
  await recordAuditEvent(db, { businessId: scope.businessId, actorId: userId, action: 'MANUAL_RESOLUTION', entityType: 'expected_payment', entityId: id,
    newData: { transaction_id: transactionId, resolution: 'candidate_dismissed', amount: transaction.amount,
      currency: transaction.currency, reference: typeof transaction.metadata?.external_reference === 'string' ? transaction.metadata.external_reference : null } });
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
    const { data: tx, error: transactionError } = await db
        .from('transactions')
        .select('id, provider_status, expected_payment_id, store_id, amount, currency, occurred_at, metadata, provider')
      .eq('id', action.transactionId)
      .eq('business_id', scope.businessId)
      .maybeSingle<{ id: string; provider_status: string | null; expected_payment_id: string | null; store_id: string | null; amount: number; currency: string; occurred_at: string; metadata: Record<string, unknown> | null; provider: string | null }>();
if (transactionError) throw transactionError;
    if (!tx) throw new ScopeError('Movimiento no encontrado', 403);
    if (scope.storeId && tx.store_id !== scope.storeId) throw new ScopeError('Acceso denegado a esta tienda', 403);
    if (tx.provider_status !== 'CONFIRMED') throw new ScopeError('El movimiento no está acreditado', 400);
    if (tx.expected_payment_id && tx.expected_payment_id !== id) {
      throw new ScopeError('Ese movimiento ya está asignado a otro cobro', 400);
    }
    const { data: matched, error } = await db
      .from('expected_payments')
      .update({ status: 'MATCHED', matched_transaction_id: tx.id, matched_at: new Date().toISOString(), match_score: null, match_candidates: [] })
      .eq('id', id)
      .eq('business_id', scope.businessId)
      .in('status', ['WAITING', 'MANUAL_REVIEW'])
      .select('id')
      .maybeSingle<{ id: string }>();
    if (error) {
      if (error.code === '23505') throw new ScopeError('Ese movimiento ya está asignado a otro cobro', 400);
      throw error;
    }
    if (!matched) throw new ScopeError('El cobro ya fue resuelto o el movimiento ya está asignado', 400);
    const { data: linked, error: linkError } = await db
      .from('transactions')
      .update({ expected_payment_id: id })
      .eq('id', tx.id)
      .eq('business_id', scope.businessId)
      .is('expected_payment_id', null)
      .select('id')
      .maybeSingle<{ id: string }>();
    if (linkError) throw linkError;
    if (!linked) {
      await db.from('expected_payments').update({ status: current.status, matched_transaction_id: null, matched_at: null })
        .eq('id', id).eq('business_id', scope.businessId).eq('status', 'MATCHED').eq('matched_transaction_id', tx.id);
      throw new ScopeError('Ese movimiento ya está asignado a otro cobro', 400);
    }
    await recordAuditEvent(db, { businessId: scope.businessId, actorId: userId, action: 'MANUAL_RESOLUTION', entityType: 'expected_payment', entityId: id,
      newData: { transaction_id: tx.id, resolution: 'matched', amount: tx.amount, currency: tx.currency,
        reference: typeof tx.metadata?.external_reference === 'string' ? tx.metadata.external_reference : null } });
  }

  if (action.type === 'cancel') await recordAuditEvent(db, { businessId: scope.businessId, actorId: userId, action: 'MANUAL_RESOLUTION', entityType: 'expected_payment', entityId: id,
    newData: { resolution: 'cancelled' } });
  return getExpectedPayment(scope, id);
}
