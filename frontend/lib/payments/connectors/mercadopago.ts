import { verifyMercadoPagoSignature } from '../mercadopagoSignature';
import { isInternalMercadoPagoMovement, normalizeMercadoPagoPayment } from '../normalize';
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
    // Conexiones OAuth no guardan clave propia: usan la clave secreta de la app de PayAlert (una para todas las cuentas).
    const webhookSecret = connection?.webhookSecret || process.env.MP_WEBHOOK_SECRET || null;
    if (!connection || !webhookSecret) return { kind: 'rejected', reason: 'missing_secret' };
    const externalId = request.query['data.id'] || asIdentifier(asRecord(body.data)?.id);
    if (!externalId) return { kind: 'rejected', reason: 'missing_id' };
    const signature = verifyMercadoPagoSignature({ xSignature: header(request, 'x-signature'),
      xRequestId: header(request, 'x-request-id'), dataId: externalId,
      secret: webhookSecret, toleranceSeconds: 600 });
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

  /** Uses the documented payment search endpoint; bounded to 24 hours and 100 results. */
  async listRecentTransactions(connection: PaymentConnection, since?: string) {
    const end = new Date();
    const start = new Date(Math.max(since ? Date.parse(since) : end.getTime() - 24 * 60 * 60_000,
      end.getTime() - 24 * 60 * 60_000));
    const params = new URLSearchParams({ sort: 'date_created', criteria: 'desc', range: 'date_created',
      begin_date: start.toISOString(), end_date: end.toISOString(), limit: '100' });
    const response = await this.fetchImpl(`https://api.mercadopago.com/v1/payments/search?${params}`, {
      method: 'GET', headers: { Authorization: `Bearer ${connection.credentials.access_token}` },
    });
    if (!response.ok) throw new ProviderError(this.provider, response.status);
    const data = await response.json() as { results?: unknown };
    if (!Array.isArray(data.results)) throw new Error('mercado_pago_search_invalid_response');
    return data.results.filter((payment) => !isInternalMercadoPagoMovement(payment)).map(normalizeMercadoPagoPayment);
  }

  async healthCheck(connection: PaymentConnection): Promise<{ ok: boolean; detail?: string }> {
    try {
      const response = await this.fetchImpl('https://api.mercadopago.com/users/me', {
        method: 'GET', headers: { Authorization: `Bearer ${connection.credentials.access_token}` },
      });
      if (response.ok) return { ok: true };
      if (response.status === 401 || response.status === 403) return { ok: false, detail: 'invalid_token' };
      return { ok: false, detail: response.status >= 500 || response.status === 429 ? 'provider_unavailable' : 'health_check_failed' };
    } catch {
      return { ok: false, detail: 'request_failed' };
    }
  }
}
