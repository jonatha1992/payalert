import { NextRequest, NextResponse } from 'next/server';
import { runAutomaticSync, type AutomaticConnection } from '@/lib/payments/automaticSync';
import { getConnector } from '@/lib/payments/connectors';
import { ingestWebhook } from '@/lib/payments/ingest';
import { syncConnectionPayments } from '@/lib/payments/manualSync';
import { tallyPaymentKinds, type PaymentKindCounts } from '@/lib/payments/paymentKinds';
import { refreshAccessToken } from '@/lib/payments/connectors/mercadopagoOAuth';
import { encryptSecret } from '@/lib/payments/secretBox';
import { ensureFreshCredentials } from '@/lib/payments/tokenRefresh';
import { authorizeCron } from '@/lib/server/cronAuth';
import { recordAuditEvent } from '@/lib/server/audit';
import { CONNECTION_COLUMNS, SupabasePaymentsRepository, toConnection, type ConnectionRow } from '@/lib/server/paymentsRepository';
import { getServiceClient } from '@/lib/server/session';
import { logStructured } from '@/lib/server/structuredLog';
import type { NormalizedTransaction, WebhookRequest } from '@/lib/payments/types';

const MAX_CONNECTIONS = 20;
const BUDGET_MS = 45_000;

function oauthConfig() {
  const clientId = process.env.MP_CLIENT_ID;
  const clientSecret = process.env.MP_CLIENT_SECRET;
  const redirectUri = process.env.MP_OAUTH_REDIRECT_URI;
  return clientId && clientSecret && redirectUri ? { clientId, clientSecret, redirectUri } : null;
}

async function handler(request: NextRequest) {
  const status = authorizeCron(request.headers.get('authorization'), process.env.CRON_SECRET);
  if (status !== 200) return NextResponse.json({ error: status === 503 ? 'cron_not_configured' : 'unauthorized' }, { status });
  try {
    const db = getServiceClient();
    const kinds: PaymentKindCounts = {};
    const result = await runAutomaticSync({ maxConnections: MAX_CONNECTIONS, budgetMs: BUDGET_MS,
      listConnections: async limit => {
        const { data, error } = await db.from('payment_connections').select(`${CONNECTION_COLUMNS}, last_sync_at`)
          .eq('provider', 'mercado_pago').in('status', ['CONNECTED', 'DEGRADED']).order('last_sync_at', { ascending: true, nullsFirst: true }).limit(limit);
        if (error) throw error;
        return (data ?? []).map(row => ({ ...toConnection(row as ConnectionRow),
          lastSyncedAt: (row as ConnectionRow & { last_sync_at: string | null }).last_sync_at })) as AutomaticConnection[];
      },
      syncConnection: async (rawConnection, since) => {
        const oauth = oauthConfig();
        const connection = oauth ? await ensureFreshCredentials(rawConnection, {
          refresh: token => refreshAccessToken(token, oauth),
          persist: async (selected, credentials) => {
            const { error } = await db.from('payment_connections').update({ credentials_encrypted: encryptSecret(JSON.stringify(credentials)),
              status: 'CONNECTED', last_error: null }).eq('id', selected.id).eq('business_id', selected.businessId);
            if (error) throw error;
          },
          markReauthRequired: async selected => {
            await db.from('payment_connections').update({ status: 'REAUTH_REQUIRED', last_error: 'oauth_refresh_failed',
              updated_at: new Date().toISOString() }).eq('id', selected.id).eq('business_id', selected.businessId);
          },
        }) : rawConnection;
        const connector = getConnector(connection.provider);
        if (!connector.listRecentTransactions) throw new Error('sync_not_supported');
        const repo = new SupabasePaymentsRepository(db);
        return syncConnectionPayments(connection, {
          listTransactions: async selected => {
            const found = await connector.listRecentTransactions!(selected, since);
            tallyPaymentKinds(found, kinds);
            return found;
          },
          ingest: async (selected, transaction: NormalizedTransaction) => {
            const webhookRequest: WebhookRequest = { rawBody: '', headers: {}, query: { connection: selected.id } };
            const authoritative = { ...connector, fetchTransaction: async (_: typeof selected, id: string) => {
              if (id !== transaction.externalId) throw new Error('sync_transaction_id_mismatch');
              return transaction;
            } };
            const ingested = await ingestWebhook({ provider: selected.provider, request: webhookRequest,
              repo, connectorFactory: () => authoritative });
            return ingested.outcome === 'processed' ? 'processed' : ingested.outcome === 'duplicate' ? 'duplicate' : 'failed';
          },
          recordFreshness: async (selected, timestamp) => {
            const { error } = await db.from('payment_connections').update({ last_sync_at: timestamp,
              last_sync_source: 'automatic_provider_sync', updated_at: timestamp }).eq('id', selected.id).eq('business_id', selected.businessId);
            if (error) throw error;
          },
          audit: (selected, timestamp, count) => recordAuditEvent(db, { businessId: selected.businessId, actorId: 'system',
            action: 'CONFIGURATION_UPDATED', entityType: 'payment_connection_sync', entityId: selected.id,
            newData: { source: 'automatic_provider_sync', checked_at: timestamp, newly_processed: count } }),
          log: fields => logStructured('automatic_provider_sync', { ...fields }),
        });
      },
    });
    logStructured('automatic_provider_sync_batch', { selected: result.selected, succeeded: result.succeeded,
      failed: result.failed, skipped: result.skipped, kinds: JSON.stringify(kinds) });
    return NextResponse.json({ ...result, kinds });
  } catch {
    console.error(JSON.stringify({ event: 'automatic_provider_sync_batch_failed' }));
    return NextResponse.json({ error: 'sync_batch_failed' }, { status: 500 });
  }
}

export const maxDuration = 60;
export const GET = handler;
export const POST = handler;
