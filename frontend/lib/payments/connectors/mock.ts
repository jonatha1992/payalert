import type { NormalizedTransaction, PaymentConnection, PaymentConnector, WebhookParseResult, WebhookRequest } from '../types';
import { ProviderError } from './errors';
import { asIdentifier, readWebhookBody } from './payload';

/** Dev/test adapter: reseed an id to simulate state changes; replay it to simulate duplicates. */
export class MockConnector implements PaymentConnector {
  readonly provider = 'mock' as const;
  private readonly transactions = new Map<string, NormalizedTransaction>();

  constructor(_fetchImpl: typeof fetch = fetch) {}

  seed(tx: NormalizedTransaction): void {
    this.transactions.set(tx.externalId, structuredClone(tx));
  }

  parseWebhook(request: WebhookRequest, _connection: PaymentConnection | null): WebhookParseResult {
    const externalId = asIdentifier(readWebhookBody(request)?.externalId);
    return externalId ? { kind: 'accepted', externalId, providerAccountId: null,
      providerOrderId: null, eventType: 'payment' } : { kind: 'rejected', reason: 'missing_id' };
  }

  async fetchTransaction(_connection: PaymentConnection, externalId: string): Promise<NormalizedTransaction> {
    const tx = this.transactions.get(externalId);
    if (!tx) throw new ProviderError(this.provider, 404);
    return structuredClone(tx);
  }

  async healthCheck(_connection: PaymentConnection): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}
