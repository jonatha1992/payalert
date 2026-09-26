import { verifyMercadoPagoSignature } from '../mercadopagoSignature';
import { normalizeMercadoPagoPayment } from '../normalize';
import type { PaymentConnection, PaymentConnector, WebhookParseResult, WebhookRequest } from '../types';
import { ProviderError } from './errors';
import { asIdentifier, asRecord, header, readWebhookBody } from './payload';

export class MercadoPagoConnector implements PaymentConnector {
  readonly provider = 'mercado_pago' as const;

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  parseWebhook(request: WebhookRequest, connection: PaymentConnection | null): WebhookParseResult {
    const body = readWebhookBody(request);
    if (!body) return { kind: 'rejected', reason: 'invalid_body' };
    const eventType = request.query.type || asIdentifier(body.type) || asIdentifier(body.topic);
    if (eventType !== 'payment') return { kind: 'ignored', reason: 'unsupported_type' };
    if (!connection?.webhookSecret) return { kind: 'rejected', reason: 'missing_secret' };
    const externalId = request.query['data.id'] || asIdentifier(asRecord(body.data)?.id);
    if (!externalId) return { kind: 'rejected', reason: 'missing_id' };
    const signature = verifyMercadoPagoSignature({ xSignature: header(request, 'x-signature'),
      xRequestId: header(request, 'x-request-id'), dataId: externalId,
      secret: connection.webhookSecret, toleranceSeconds: 600 });
    if (!signature.ok) return { kind: 'rejected', reason: signature.reason };
    return { kind: 'accepted', externalId, providerAccountId: asIdentifier(body.user_id),
      providerOrderId: null, eventType };
  }

  async fetchTransaction(connection: PaymentConnection, externalId: string) {
    const response = await this.fetchImpl(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(externalId)}`, {
      method: 'GET', headers: { Authorization: `Bearer ${connection.credentials.access_token}` },
    });
    if (!response.ok) throw new ProviderError(this.provider, response.status);
    return normalizeMercadoPagoPayment(await response.json());
  }

  async healthCheck(connection: PaymentConnection): Promise<{ ok: boolean; detail?: string }> {
    try {
      const response = await this.fetchImpl('https://api.mercadopago.com/users/me', {
        method: 'GET', headers: { Authorization: `Bearer ${connection.credentials.access_token}` },
      });
      return { ok: response.ok };
    } catch {
      return { ok: false, detail: 'request_failed' };
    }
  }
}
