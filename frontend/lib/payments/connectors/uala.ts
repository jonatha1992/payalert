import { normalizeUalaOrder } from '../normalize';
import type { CreateChargeInput, CreateChargeResult, PaymentConnection, PaymentConnector,
  WebhookParseResult, WebhookRequest } from '../types';
import { ProviderError } from './errors';
import { asIdentifier, asRecord, readWebhookBody } from './payload';

function bases(connection: PaymentConnection) {
  const stage = connection.credentials.environment === 'stage' ? '.stage' : '';
  return { auth: `https://auth${stage}.developers.ar.ua.la/v2/api`,
    checkout: `https://checkout${stage}.developers.ar.ua.la/v2/api` };
}

export class UalaConnector implements PaymentConnector {
  readonly provider = 'uala' as const;

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  parseWebhook(request: WebhookRequest, _connection: PaymentConnection | null): WebhookParseResult {
    const externalId = asIdentifier(readWebhookBody(request)?.uuid);
    if (!externalId) return { kind: 'rejected', reason: 'missing_uuid' };
    return { kind: 'accepted', externalId, providerOrderId: externalId,
      providerAccountId: null, eventType: 'order' };
  }

  private async token(connection: PaymentConnection): Promise<string> {
    const { username, client_id, client_secret_id } = connection.credentials;
    const response = await this.fetchImpl(`${bases(connection).auth}/auth/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, client_id, client_secret_id, grant_type: 'client_credentials' }),
    });
    if (!response.ok) throw new ProviderError(this.provider, response.status);
    const data = asRecord(await response.json());
    if (typeof data?.access_token !== 'string' || !data.access_token.trim()) {
      throw new Error('Uala token response is missing access_token');
    }
    return data.access_token;
  }

  async fetchTransaction(connection: PaymentConnection, externalId: string) {
    const token = await this.token(connection);
    const response = await this.fetchImpl(`${bases(connection).checkout}/orders/${encodeURIComponent(externalId)}`, {
      method: 'GET', headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new ProviderError(this.provider, response.status);
    return normalizeUalaOrder(await response.json());
  }

  async createCharge(connection: PaymentConnection, input: CreateChargeInput): Promise<CreateChargeResult> {
    const token = await this.token(connection);
    // The docs table says cents, but its curl example sends "10.90". Require explicit opt-in to cents.
    const amount = connection.credentials.amount_in_cents === 'true'
      ? String(Math.round(input.amount * 100)) : input.amount.toFixed(2);
    const response = await this.fetchImpl(`${bases(connection).checkout}/checkout`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, description: input.description, callback_fail: input.failureUrl,
        callback_success: input.successUrl, notification_url: input.notificationUrl,
        external_reference: input.expectedPaymentId }),
    });
    if (!response.ok) throw new ProviderError(this.provider, response.status);
    const data = asRecord(await response.json());
    const providerOrderId = asIdentifier(data?.uuid);
    const checkoutUrl = asRecord(data?.links)?.checkout_link;
    if (!providerOrderId || typeof checkoutUrl !== 'string' || !checkoutUrl) {
      throw new Error('Uala checkout response is missing uuid or checkout_link');
    }
    return { providerOrderId, checkoutUrl };
  }

  async healthCheck(connection: PaymentConnection): Promise<{ ok: boolean; detail?: string }> {
    try {
      await this.token(connection);
      return { ok: true };
    } catch (error) {
      if (error instanceof ProviderError && (error.status === 401 || error.status === 403)) {
        return { ok: false, detail: 'invalid_token' };
      }
      if (error instanceof ProviderError && error.retriable) return { ok: false, detail: 'provider_unavailable' };
      return { ok: false, detail: 'token_request_failed' };
    }
  }
}
