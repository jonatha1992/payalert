import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  enqueue: vi.fn(), findConnectionByProviderAccount: vi.fn(), findConnectionByOrder: vi.fn(), findConnectionById: vi.fn(),
  fetchTransaction: vi.fn(), sendPushToBusiness: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/hubWebhook', () => ({ applyHubPayment: vi.fn() }));
vi.mock('@/lib/server/webhookQueue', () => ({ WebhookQueue: vi.fn(() => ({ enqueue: mocks.enqueue })) }));
vi.mock('@/lib/server/session', () => ({ getServiceClient: vi.fn(() => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) })) }));
vi.mock('@/lib/server/paymentsRepository', () => ({ SupabasePaymentsRepository: vi.fn(() => ({
  findConnectionByProviderAccount: mocks.findConnectionByProviderAccount,
  findConnectionByOrder: mocks.findConnectionByOrder,
  findConnectionById: mocks.findConnectionById,
})) }));
vi.mock('@/lib/payments/connectors', () => ({ getConnector: vi.fn(() => ({
  parseWebhook: (request: { rawBody: string }, connection: { webhookSecret: string } | null) => {
    if (!connection?.webhookSecret) return { kind: 'rejected', reason: 'missing_secret' };
    const body = JSON.parse(request.rawBody);
    return body.signatureValid === false ? { kind: 'rejected', reason: 'signature_mismatch' }
      : { kind: 'accepted', externalId: String(body.data.id), providerAccountId: String(body.user_id), providerOrderId: null, eventType: 'payment' };
  }, fetchTransaction: mocks.fetchTransaction,
})) }));
vi.mock('@/lib/payments/ingest', () => ({ ingestWebhook: vi.fn() }));
vi.mock('@/lib/server/push', () => ({ sendPushToBusiness: mocks.sendPushToBusiness }));

import { handleProviderWebhook } from '@/lib/server/webhookHandler';

const connection = { id: 'connection-1', businessId: 'business-1', provider: 'mercado_pago', providerAccountId: 'acct', webhookSecret: 'test-secret' };
function request(body: unknown, raw?: string) {
  return { headers: new Headers(), nextUrl: new URL('https://example.test/api/webhooks/mercadopago'),
    text: async () => raw ?? JSON.stringify(body) } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findConnectionByProviderAccount.mockResolvedValue(connection);
  mocks.findConnectionByOrder.mockResolvedValue(connection);
  mocks.findConnectionById.mockResolvedValue(connection);
  mocks.enqueue.mockResolvedValue('enqueued');
  
});

describe('fast webhook acknowledgement', () => {
  it('enqueues then ACKs without fetching from provider or sending push', async () => {
    const response = await handleProviderWebhook('mercado_pago', request({ user_id: 'acct', data: { id: 'payment-1' } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(mocks.enqueue).toHaveBeenCalledWith(expect.objectContaining({ provider: 'mercado_pago', connection_id: 'connection-1', dedupe_key: 'payment-1' }));
    expect(mocks.fetchTransaction).not.toHaveBeenCalled();
    expect(mocks.sendPushToBusiness).not.toHaveBeenCalled();
  });

  it('does not enqueue invalid signatures', async () => {
    const response = await handleProviderWebhook('mercado_pago', request({ user_id: 'acct', data: { id: 'payment-1' }, signatureValid: false }));
    expect(response.status).toBe(401);
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it('rejects a body larger than 256 KiB', async () => {
    const response = await handleProviderWebhook('mercado_pago', request({}, 'x'.repeat(256 * 1024 + 1)));
    expect(response.status).toBe(413);
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it('ACKs duplicate deliveries without enqueuing a second time', async () => {
    mocks.enqueue.mockResolvedValue('duplicate');
    const response = await handleProviderWebhook('mercado_pago', request({ user_id: 'acct', data: { id: 'same' } }));
    expect(response.status).toBe(200);
    expect(mocks.enqueue).toHaveBeenCalledTimes(1);
    expect(mocks.fetchTransaction).not.toHaveBeenCalled();
  });
});
