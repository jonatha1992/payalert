// Server-only module: shared Next.js webhook handler for every provider.
import { NextResponse, type NextRequest } from 'next/server';
import { getConnector } from '@/lib/payments/connectors';
import { ingestWebhook, type IngestResult } from '@/lib/payments/ingest';
import type { PaymentConnector, Provider, WebhookRequest } from '@/lib/payments/types';
import { sendPushToBusiness } from '@/lib/server/push';
import { SupabasePaymentsRepository } from '@/lib/server/paymentsRepository';
import { getServiceClient } from '@/lib/server/session';

const MAX_BODY_BYTES = 64 * 1024;

export async function toWebhookRequest(request: NextRequest): Promise<WebhookRequest> {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  const query: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  const rawBody = (await request.text()).slice(0, MAX_BODY_BYTES);
  return { headers, query, rawBody };
}

const currency = (amount: number, code: string) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: code || 'ARS' }).format(amount);

/** Ingests one notification and fans out the push. Shared by provider webhooks and the dev simulator. */
export async function processWebhook(
  provider: Provider,
  webhookRequest: WebhookRequest,
  connectorFactory: (provider: Provider) => PaymentConnector = getConnector,
): Promise<IngestResult> {
  const repo = new SupabasePaymentsRepository(getServiceClient());
  const result = await ingestWebhook({ provider, request: webhookRequest, repo, connectorFactory });

  if (result.notify && result.notification && result.transactionId) {
    const { data } = await getServiceClient()
      .from('transactions')
      .select('business_id')
      .eq('id', result.transactionId)
      .maybeSingle<{ business_id: string }>();
    if (data) {
      const n = result.notification;
      const matched = result.match?.decision === 'AUTO';
      try {
        await sendPushToBusiness(
          { businessId: data.business_id, storeId: n.storeId },
          {
            title: matched ? 'Cobro confirmado' : 'Pago acreditado',
            body: `${currency(n.amount, n.currency)} · ${new Date(n.occurredAt).toLocaleTimeString('es-AR', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'America/Argentina/Buenos_Aires',
            })}`,
            tag: `payment-${result.transactionId}`,
            data: { transactionId: result.transactionId, url: '/dashboard/terminal' },
          },
        );
      } catch (error) {
        // The payment is already stored; a push failure must not make the provider retry.
        console.error('[payments] push failed:', error instanceof Error ? error.message : 'unknown');
      }
    }
  }

  return result;
}

export async function handleProviderWebhook(provider: Provider, request: NextRequest): Promise<NextResponse> {
  const result = await processWebhook(provider, await toWebhookRequest(request));
  // The body never echoes provider data back.
  return NextResponse.json({ received: true, outcome: result.outcome }, { status: result.httpStatus });
}
