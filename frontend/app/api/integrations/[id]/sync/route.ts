import { NextRequest, NextResponse } from 'next/server';
import { getConnector } from '@/lib/payments/connectors';
import { ingestWebhook } from '@/lib/payments/ingest';
import { syncConnectionPayments } from '@/lib/payments/manualSync';
import { withRateLimit } from '@/lib/security/withRateLimit';
import { webhookRateLimiter } from '@/lib/security/rateLimiter';
import { getClientIP } from '@/lib/security/withRateLimit';
import { recordAuditEvent } from '@/lib/server/audit';
import { logStructured } from '@/lib/server/structuredLog';
import { CONNECTION_COLUMNS, SupabasePaymentsRepository, toConnection, type ConnectionRow } from '@/lib/server/paymentsRepository';
import { ScopeError } from '@/lib/server/scope';
import { getServiceClient, getSessionProfile, scopeErrorResponse } from '@/lib/server/session';
import { requirePermission } from '@/lib/server/rbac';
import type { NormalizedTransaction, WebhookRequest } from '@/lib/payments/types';

type Context = { params: Promise<{ id: string }> };

async function handler(request: NextRequest, context: Context) {
  try {
    const profile = requirePermission(await getSessionProfile(request), 'connection', 'update');
    const businessId = profile.businessId;
    if (!businessId) throw new ScopeError('Usuario sin negocio asignado', 403);
    const { id } = await context.params;
    const db = getServiceClient();
    const { data, error } = await db.from('payment_connections').select(CONNECTION_COLUMNS)
      .eq('id', id).eq('business_id', businessId).neq('status', 'DISCONNECTED').maybeSingle<ConnectionRow>();
    if (error) throw error;
    if (!data) throw new ScopeError('Integración no encontrada', 403);
    const connection = toConnection(data);
    const connector = getConnector(connection.provider);
    if (!connector.listRecentTransactions) throw new ScopeError('La sincronización no está disponible para esta integración.', 400);
    const dbRepo = new SupabasePaymentsRepository(db);
  const result = await syncConnectionPayments(connection, {
    listTransactions: selected => connector.listRecentTransactions!(selected),
      ingest: async (selected, transaction: NormalizedTransaction) => {
        const request: WebhookRequest = { rawBody: '', headers: {}, query: { connection: selected.id } };
        const authoritative = { ...connector, fetchTransaction: async (_: typeof selected, externalId: string) => {
          if (externalId !== transaction.externalId) throw new Error('sync_transaction_id_mismatch');
          return transaction;
        } };
        const response = await ingestWebhook({ provider: selected.provider, request, repo: dbRepo,
          connectorFactory: () => authoritative });
        return response.outcome === 'processed' ? 'processed' : response.outcome === 'duplicate' ? 'duplicate' : 'failed';
      },
      recordFreshness: async (selected, timestamp) => {
        const { error: updateError } = await db.from('payment_connections').update({ last_sync_at: timestamp,
          last_sync_source: 'manual_provider_sync', updated_at: timestamp }).eq('id', selected.id).eq('business_id', businessId);
        if (updateError) throw updateError;
      },
      audit: (selected, timestamp, count) => recordAuditEvent(db, { businessId, actorId: profile.userId,
        action: 'CONFIGURATION_UPDATED', entityType: 'payment_connection_sync', entityId: selected.id,
        newData: { source: 'manual_provider_sync', checked_at: timestamp, newly_processed: count } }),
      log: fields => logStructured('manual_provider_sync', fields),
    });
    return NextResponse.json(result);
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    if (error instanceof Error && error.message === 'provider_sync_failed') {
      logStructured('manual_provider_sync', { outcome: 'provider_error' });
      return NextResponse.json({ error: 'No pudimos consultar al proveedor. Probá más tarde.' }, { status: 502 });
    }
    if (error instanceof Error && error.message === 'provider_sync_ingest_failed') {
      return NextResponse.json({ error: 'No pudimos procesar todos los pagos consultados.' }, { status: 500 });
    }
    logStructured('manual_provider_sync', { outcome: 'failed' });
    return NextResponse.json({ error: 'No pudimos sincronizar esta integración.' }, { status: 500 });
  }
}

export const POST = withRateLimit(handler, { limiter: webhookRateLimiter,
  key: request => `manual-sync:${getClientIP(request)}:${request.nextUrl.pathname}` });
