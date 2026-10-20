import type { SupabaseClient } from '@supabase/supabase-js';
import { connectorForSyncedTransaction } from './syncConnector';
import { syncConnectionPayments } from './manualSync';
import { ensureFreshCredentials } from './tokenRefresh';
import { refreshAccessToken } from './connectors/mercadopagoOAuth';
import { encryptSecret } from './secretBox';
import { CONNECTION_COLUMNS, SupabasePaymentsRepository, toConnection, type ConnectionRow } from '@/lib/server/paymentsRepository';
import type { NormalizedTransaction, PaymentConnection, WebhookRequest } from './types';

export interface HintSyncDependencies {
  db: SupabaseClient;
  getConnector(provider: PaymentConnection['provider']): ReturnType<typeof import('./connectors').getConnector>;
  ingest(input: { provider: PaymentConnection['provider']; request: WebhookRequest; repo: SupabasePaymentsRepository; connector: ReturnType<typeof import('./connectors').getConnector>; transaction: NormalizedTransaction }): Promise<'processed' | 'duplicate' | 'failed'>;
  sendPush(target: { businessId: string; storeId: string | null }, message: { title: string; body: string; data: { transactionId: string } }): Promise<void>;
  sleep(ms: number): Promise<void>;
  logger(event: string, fields: Record<string, unknown>): void;
  oauth: { clientId: string; clientSecret: string; redirectUri: string } | null;
}

const RETRY_DELAYS_MS = [0, 5_000, 5_000, 5_000] as const;
const inFlight = new Map<string, Promise<void>>();

export function synchronizeHint(businessId: string, storeId: string | null, hintId: string, deps: HintSyncDependencies): Promise<void> {
  const existing = inFlight.get(businessId);
  if (existing) return existing;
  const task = runSync(businessId, storeId, hintId, deps);
  inFlight.set(businessId, task);
  return task.finally(() => { if (inFlight.get(businessId) === task) inFlight.delete(businessId); });
}

async function runSync(businessId: string, storeId: string | null, hintId: string, deps: HintSyncDependencies): Promise<void> {
  let wasPending = false;
  try {
    const { data: before } = await deps.db.from('transactions').select('provider_status').eq('id', hintId).eq('business_id', businessId).maybeSingle<{ provider_status: string }>();
    wasPending = before?.provider_status === 'PENDING';
  } catch (error) {
    deps.logger('mobile_payment_hint_sync_attempt', { businessId, hintId, attempt: 0, outcome: 'error', errorName: error instanceof Error ? error.name : 'UnknownError', errorMessage: error instanceof Error ? error.message : String(error), cause: error instanceof Error && error.cause instanceof Error ? error.cause.message : undefined });
  }
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    if (RETRY_DELAYS_MS[attempt]) await deps.sleep(RETRY_DELAYS_MS[attempt]);
    try {
      const { data: rows, error } = await deps.db.from('payment_connections').select(`${CONNECTION_COLUMNS}, last_sync_at`)
        .eq('business_id', businessId).eq('provider', 'mercado_pago').in('status', ['CONNECTED', 'DEGRADED']);
      if (error) throw error;
      const connections = (rows ?? []).map(row => toConnection(row as ConnectionRow));
      if (!connections.length) {
        deps.logger('mobile_payment_hint_sync_attempt', { businessId, hintId, attempt: attempt + 1, outcome: 'no_active_connection' });
        return;
      }
      const repo = new SupabasePaymentsRepository(deps.db);
      for (const raw of connections) {
        const connection = deps.oauth ? await ensureFreshCredentials(raw, {
          refresh: token => refreshAccessToken(token, deps.oauth!),
          persist: async (selected, credentials) => {
            const { error: updateError } = await deps.db.from('payment_connections').update({ credentials_encrypted: encryptSecret(JSON.stringify(credentials)), status: 'CONNECTED', last_error: null }).eq('id', selected.id).eq('business_id', businessId);
            if (updateError) throw updateError;
          },
          markReauthRequired: async selected => {
            const { error: updateError } = await deps.db.from('payment_connections').update({ status: 'REAUTH_REQUIRED', last_error: 'oauth_refresh_failed', updated_at: new Date().toISOString() }).eq('id', selected.id).eq('business_id', businessId);
            if (updateError) throw updateError;
          },
        }) : raw;
        const connector = deps.getConnector(connection.provider);
        if (!connector.listRecentTransactions) throw new Error('sync_not_supported');
        const result = await syncConnectionPayments(connection, {
          listTransactions: selected => connector.listRecentTransactions!(selected),
          ingest: (selected, transaction) => deps.ingest({ provider: selected.provider, request: { rawBody: '', headers: {}, query: { connection: selected.id } }, repo, connector, transaction }),
          recordFreshness: async (selected, timestamp) => {
            const { error: updateError } = await deps.db.from('payment_connections').update({ last_sync_at: timestamp, last_sync_source: 'mobile_payment_hint', updated_at: timestamp }).eq('id', selected.id).eq('business_id', businessId);
            if (updateError) throw updateError;
          }, audit: async () => undefined, log: fields => deps.logger('mobile_payment_hint_provider_sync', fields),
        });
        const { data: hint } = await deps.db.from('transactions').select('provider_status, amount').eq('id', hintId).eq('business_id', businessId).maybeSingle<{ provider_status: string; amount: number }>();
        const confirmed = hint?.provider_status === 'CONFIRMED';
        deps.logger('mobile_payment_hint_sync_attempt', { businessId, hintId, attempt: attempt + 1, connectionId: connection.id, checked: result.checked, outcome: confirmed ? 'confirmed' : 'not_found' });
        if (confirmed) {
          // La confirmación la hace SOLO la conciliación con el pago real (ingest.ts); acá solo se avisa una vez.
          if (wasPending && hint) await deps.sendPush({ businessId, storeId }, { title: 'Transferencia confirmada', body: `Llegó la transferencia de $${Number(hint.amount).toLocaleString('es-AR')} (confirmada)`, data: { transactionId: hintId } });
          return;
        }
      }
    } catch (error) {
      deps.logger('mobile_payment_hint_sync_attempt', { businessId, hintId, attempt: attempt + 1, outcome: 'error', errorName: error instanceof Error ? error.name : 'UnknownError', errorMessage: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300), cause: error instanceof Error && error.cause instanceof Error ? error.cause.message.slice(0, 300) : undefined });
    }
  }
}

export function createHintSyncDependencies(input: Omit<HintSyncDependencies, 'ingest'> & { ingestWebhook(input: Parameters<typeof import('./ingest').ingestWebhook>[0]): ReturnType<typeof import('./ingest').ingestWebhook> }): HintSyncDependencies {
  const { ingestWebhook } = input;
  return { ...input, ingest: async ({ provider, request, repo, connector, transaction }) => {
    const authoritative = connectorForSyncedTransaction(connector, transaction);
    const result = await ingestWebhook({ provider, request, repo, connectorFactory: () => authoritative });
    return result.outcome === 'processed' ? 'processed' : result.outcome === 'duplicate' ? 'duplicate' : 'failed';
  } };
}
