// Server-only module: Supabase implementation of PaymentsRepository.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentAuditEntry, PaymentsRepository, StatusTransitionPolicy, WebhookLogEntry } from '@/lib/payments/ingest';
import type { MatchEvidence } from '@/lib/payments/matching';
import { decryptSecret } from '@/lib/payments/secretBox';
import type {
  ConnectionStatus,
  ExpectedPayment,
  ExpectedPaymentStatus,
  MovementStatus,
  NormalizedTransaction,
  PaymentConnection,
  Provider,
} from '@/lib/payments/types';

const TX_ID_PREFIX: Record<Provider, string> = { mercado_pago: 'mp', uala: 'uala', mock: 'mock' };

/** Legacy `transactions.status` values the dashboard already understands. */
export function legacyStatus(status: MovementStatus): string {
  switch (status) {
    case 'CONFIRMED':
      return 'completed';
    case 'PENDING':
      return 'pending';
    case 'REJECTED':
      return 'failed';
    case 'REVERSED':
      return 'reversed';
    default:
      return 'unknown';
  }
}

export interface ConnectionRow {
  id: string;
  business_id: string;
  store_id: string | null;
  provider: Provider;
  provider_account_id: string | null;
  status: ConnectionStatus;
  credentials_encrypted: string;
  webhook_secret_encrypted: string | null;
}

export const CONNECTION_COLUMNS =
  'id, business_id, store_id, provider, provider_account_id, status, credentials_encrypted, webhook_secret_encrypted';

export function toConnection(row: ConnectionRow): PaymentConnection {
  const credentials = JSON.parse(decryptSecret(row.credentials_encrypted)) as Record<string, string>;
  return {
    id: row.id,
    businessId: row.business_id,
    storeId: row.store_id,
    provider: row.provider,
    providerAccountId: row.provider_account_id,
    status: row.status,
    credentials,
    webhookSecret: row.webhook_secret_encrypted ? decryptSecret(row.webhook_secret_encrypted) : null,
  };
}

interface ExpectedRow {
  id: string;
  business_id: string;
  store_id: string | null;
  amount: number | string;
  currency: string;
  reference: string | null;
  status: ExpectedPaymentStatus;
  created_at: string;
  expires_at: string;
  provider: Provider | null;
  provider_order_id: string | null;
  checkout_url: string | null;
  match_candidates: Array<{
    transaction_id: string;
    score?: number;
    decision?: 'SUGGESTED' | 'MANUAL_REVIEW';
    amount?: number;
    currency?: string;
    reference?: string | null;
    created_at?: string;
    expires_at?: string;
    provider?: string | null;
  }> | null;
}

export function toExpectedPayment(row: ExpectedRow): ExpectedPayment {
  return {
    id: row.id,
    businessId: row.business_id,
    storeId: row.store_id,
    amount: Number(row.amount),
    currency: row.currency,
    reference: row.reference,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    provider: row.provider,
    providerOrderId: row.provider_order_id,
    checkoutUrl: row.checkout_url,
    match_candidates: row.match_candidates ?? [],
  };
}

const LOG_STATUS: Record<WebhookLogEntry['status'], string> = {
  processed: 'completed',
  duplicate: 'completed',
  unmatched: 'unmatched',
  invalid: 'invalid',
  ignored: 'ignored',
  failed: 'failed',
};

export class SupabasePaymentsRepository implements PaymentsRepository {
  db: SupabaseClient;
  constructor(db: SupabaseClient) { this.db = db; }

  private async activeConnection(query: PromiseLike<{ data: ConnectionRow | null; error: unknown }>) {
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.status === 'DISCONNECTED') return null;
    return toConnection(data);
  }

  findConnectionById(id: string) {
    return this.activeConnection(
      this.db.from('payment_connections').select(CONNECTION_COLUMNS).eq('id', id).maybeSingle<ConnectionRow>(),
    );
  }

  findConnectionByProviderAccount(provider: Provider, providerAccountId: string) {
    return this.activeConnection(
      this.db
        .from('payment_connections')
        .select(CONNECTION_COLUMNS)
        .eq('provider', provider)
        .eq('provider_account_id', providerAccountId)
        .neq('status', 'DISCONNECTED')
        .maybeSingle<ConnectionRow>(),
    );
  }

  async findConnectionByOrder(provider: Provider, providerOrderId: string) {
    const { data, error } = await this.db
      .from('expected_payments')
      .select('connection_id, business_id')
      .eq('provider', provider)
      .eq('provider_order_id', providerOrderId)
      .maybeSingle<{ connection_id: string | null; business_id: string }>();
    if (error) throw error;
    if (!data?.connection_id) return null;
    const connection = await this.findConnectionById(data.connection_id);
    // The order and the connection must belong to the same tenant.
    return connection && connection.businessId === data.business_id ? connection : null;
  }

  async upsertTransaction(
    businessId: string,
    storeId: string | null,
    tx: NormalizedTransaction,
    canTransition: StatusTransitionPolicy,
  ): Promise<{ id: string; created: boolean; previousStatus: MovementStatus | null }> {
    const id = `${TX_ID_PREFIX[tx.provider]}_${tx.externalId}`;
    const now = new Date().toISOString();
    const row = {
      id,
      business_id: businessId,
      store_id: storeId,
      type: 'income',
      category: 'Ventas',
      amount: tx.amount,
      currency: tx.currency,
      description: tx.description,
      status: legacyStatus(tx.status),
      provider_status: tx.status,
      provider: tx.provider,
      external_id: tx.externalId,
      occurred_at: tx.occurredAt,
      metadata: { ...tx.raw, external_reference: tx.externalReference },
      updated_at: now,
    };

    // 1. Insert-if-absent. ON CONFLICT DO NOTHING on (provider, external_id) makes retries idempotent.
    const inserted = await this.db
      .from('transactions')
      .upsert({ ...row, created_at: now }, { onConflict: 'provider,external_id', ignoreDuplicates: true })
      .select('id');
    if (inserted.error) throw inserted.error;
    if (inserted.data && inserted.data.length > 0) {
      return { id: inserted.data[0].id as string, created: true, previousStatus: null };
    }

    // 2. Existing row: compare-and-swap on provider_status so concurrent deliveries cannot regress it.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { data: existing, error } = await this.db
        .from('transactions')
        .select('id, business_id, provider_status')
        .eq('provider', tx.provider)
        .eq('external_id', tx.externalId)
        .single<{ id: string; business_id: string; provider_status: MovementStatus | null }>();
      if (error) throw error;
      if (existing.business_id !== businessId) {
        throw new Error('Transaction belongs to another business');
      }
      const previous = existing.provider_status ?? 'UNKNOWN';
      if (!canTransition(previous, tx.status)) {
        return { id: existing.id, created: false, previousStatus: previous };
      }

      let update = this.db
        .from('transactions')
        .update({
          status: row.status,
          provider_status: row.provider_status,
          amount: row.amount,
          occurred_at: row.occurred_at,
          metadata: row.metadata,
          updated_at: now,
        })
        .eq('id', existing.id)
        .eq('business_id', businessId);
      update = existing.provider_status === null ? update.is('provider_status', null) : update.eq('provider_status', previous);
      const swapped = await update.select('id');
      if (swapped.error) throw swapped.error;
      if (swapped.data && swapped.data.length > 0) {
        return { id: existing.id, created: false, previousStatus: previous };
      }
      // Lost the race: re-read and re-evaluate the transition.
    }
    throw new Error('Could not update transaction status after concurrent modifications');
  }

  async listOpenExpectedPayments(businessId: string, storeId?: string | null): Promise<ExpectedPayment[]> {
    let query = this.db
      .from('expected_payments')
      .select('id, business_id, store_id, amount, currency, reference, status, created_at, expires_at, provider, provider_order_id, checkout_url, match_candidates')
      .eq('business_id', businessId)
      .eq('status', 'WAITING');
    if (storeId) query = query.eq('store_id', storeId);
    const { data, error } = await query.returns<ExpectedRow[]>();
    if (error) throw error;
    return (data ?? []).map(toExpectedPayment);
  }

  async markExpectedPayment(
    id: string, status: ExpectedPaymentStatus, transactionId: string, evidence?: MatchEvidence,
  ): Promise<void> {
      const { data: tx, error: txError } = await this.db
        .from('transactions')
        .select('id, business_id')
        .eq('id', transactionId)
        .single<{ id: string; business_id: string }>();
      if (txError) throw txError;

      const now = new Date().toISOString();
      const patch = status === 'MATCHED'
        ? { status, matched_transaction_id: transactionId, matched_at: now, match_score: null, match_candidates: [] }
        : { status, match_score: evidence?.score ?? null, match_candidates: evidence ? [{
          transaction_id: transactionId,
          score: evidence.score,
          decision: evidence.decision,
          amount: evidence.amount,
          currency: evidence.currency,
          reference: evidence.reference,
          created_at: evidence.createdAt,
          expires_at: evidence.expiresAt,
          provider: evidence.provider,
        }] : [] };

      const { data, error } = await this.db
        .from('expected_payments')
        .update(patch)
        .eq('id', id)
        .eq('business_id', tx.business_id)
        .eq('status', 'WAITING')
        .select('id');
      if (error) throw error;

      if (status === 'MATCHED' && data && data.length > 0) {
        const link = await this.db
          .from('transactions')
          .update({ expected_payment_id: id })
          .eq('id', transactionId)
          .eq('business_id', tx.business_id);
        if (link.error) throw link.error;
      }
    }

  async logWebhook(entry: WebhookLogEntry): Promise<void> {
    const { error } = await this.db.from('webhook_logs').insert({
      provider: entry.provider,
      status: LOG_STATUS[entry.status],
      event_type: entry.status,
      business_id: entry.businessId,
      transaction_id: entry.transactionId ?? null,
      error_message: entry.reason ?? null,
      // Only non-sensitive metadata: never the provider body, headers or credentials.
      payload: {
        outcome: entry.status,
        connection_id: entry.connectionId,
        provider_status: entry.providerStatus ?? null,
        received_at: entry.receivedAt,
      },
      processed_at: new Date().toISOString(),
    });
    if (error) console.error('[payments] webhook log insert failed:', error.message);
  }

  async audit(entry: PaymentAuditEntry): Promise<void> {
    const { error } = await this.db.from('audit_logs').insert({
      business_id: entry.businessId,
      action: entry.action,
      entity_type: 'transaction',
      new_data: {
        transaction_id: entry.transactionId,
        connection_id: entry.connectionId,
        previous_status: entry.previousStatus,
        status: entry.status,
        occurred_at: entry.occurredAt,
      },
    });
    if (error) console.error('[payments] audit insert failed:', error.message);
  }
}
