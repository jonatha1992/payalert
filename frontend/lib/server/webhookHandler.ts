// Server-only module: shared fast-ACK handler and queued webhook processor.
import { NextResponse, type NextRequest } from 'next/server';
import { getConnector } from '@/lib/payments/connectors';
import { ingestWebhook, type IngestResult } from '@/lib/payments/ingest';
import type { PaymentConnector, Provider, WebhookRequest } from '@/lib/payments/types';
import { sendPushToBusiness } from '@/lib/server/push';
import { SupabasePaymentsRepository } from '@/lib/server/paymentsRepository';
import { WebhookQueue } from '@/lib/server/webhookQueue';
import { getServiceClient } from '@/lib/server/session';

const MAX_BODY_BYTES = 256 * 1024;

export async function toWebhookRequest(request: NextRequest): Promise<WebhookRequest> {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });
  const query: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => { query[key] = value; });
  return { headers, query, rawBody: await request.text() };
}

export function parseWebhookPayload(rawBody: string): unknown {
  try { return JSON.parse(rawBody); } catch { return rawBody; }
}

const currency = (amount: number, code: string) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: code || 'ARS' }).format(amount);

/** Executes the authoritative provider lookup and idempotent payment ingestion. */
export async function processWebhook(
  provider: Provider,
  webhookRequest: WebhookRequest,
  connectorFactory: (provider: Provider) => PaymentConnector = getConnector,
): Promise<IngestResult> {
  const db = getServiceClient();
  const repo = new SupabasePaymentsRepository(db);
  const result = await ingestWebhook({ provider, request: webhookRequest, repo, connectorFactory });
  if (result.notify && result.notification && result.transactionId) {
    const { data, error } = await db.from('transactions').select('business_id')
      .eq('id', result.transactionId).maybeSingle<{ business_id: string }>();
    if (error) throw error;
    if (data) {
      const n = result.notification;
      try {
        await sendPushToBusiness({ businessId: data.business_id, storeId: n.storeId }, {
          title: result.match?.decision === 'AUTO' ? 'Cobro confirmado' : 'Pago acreditado',
          body: `${currency(n.amount, n.currency)} · ${new Date(n.occurredAt).toLocaleTimeString('es-AR', {
            hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires',
          })}`,
          tag: `payment-${result.transactionId}`,
          data: { transactionId: result.transactionId, url: '/dashboard/terminal' },
        });
      } catch {
        console.error(JSON.stringify({ event: 'webhook_push_failed', provider }));
      }
    }
  }
  return result;
}

export async function handleProviderWebhook(provider: Provider, request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return NextResponse.json({ received: false }, { status: 413 });
  }
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });
  const query: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => { query[key] = value; });
  const webhookRequest: WebhookRequest = { headers, query, rawBody };
  const db = getServiceClient();
  const repo = new SupabasePaymentsRepository(db);
  const payload = parseWebhookPayload(rawBody);
  const value = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const account = provider === 'mercado_pago' && value.user_id != null ? String(value.user_id) : null;
  const order = provider === 'uala' && value.uuid != null ? String(value.uuid) : null;
  let connection = account ? await repo.findConnectionByProviderAccount(provider, account)
    : order ? await repo.findConnectionByOrder(provider, order) : null;
  if (!connection && query.connection) connection = await repo.findConnectionById(query.connection);
  if (!connection || connection.provider !== provider || (account && connection.providerAccountId !== account)) {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const parsed = getConnector(provider).parseWebhook(webhookRequest, connection);
  if (parsed.kind === 'rejected') return NextResponse.json({ received: false }, { status: 401 });
  if (parsed.kind === 'ignored') return NextResponse.json({ received: true }, { status: 200 });
  await new WebhookQueue(db).enqueue({ provider, connection_id: connection.id,
    dedupe_key: parsed.externalId, payload: { rawBody, headers, query } });
  return NextResponse.json({ received: true }, { status: 200 });
}
