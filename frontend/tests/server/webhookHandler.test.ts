import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  enqueue: vi.fn(), findConnectionByProviderAccount: vi.fn(), findConnectionByOrder: vi.fn(), findConnectionById: vi.fn(),
  fetchTransaction: vi.fn(), sendPushToBusiness: vi.fn(), sendPaymentEmailToBusiness: vi.fn(),
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
vi.mock('@/lib/server/emailNotifications', () => ({ sendPaymentEmailToBusiness: mocks.sendPaymentEmailToBusiness }));

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
    expect(mocks.sendPaymentEmailToBusiness).not.toHaveBeenCalled();
  });

  it('processes normal and hub payments through the same webhook pipeline', async () => {
    const { processWebhook } = await import('@/lib/server/webhookHandler');
    const { ingestWebhook } = await import('@/lib/payments/ingest');
    const { applyHubPayment } = await import('@/lib/server/hubWebhook');
    const result = { notify: false, notification: null, transactionId: null };
    vi.mocked(ingestWebhook).mockResolvedValue(result as never);
    mocks.findConnectionByProviderAccount.mockResolvedValue(connection);
    mocks.fetchTransaction.mockResolvedValue({ externalReference: 'hub-ref', externalId: 'payment-2', amount: 100, currency: 'ARS', status: 'CONFIRMED' });

    const webhook = { headers: {}, query: {}, rawBody: JSON.stringify({ user_id: 'acct', data: { id: 'payment-2' } }) };
    await processWebhook('mercado_pago', webhook);

    expect(ingestWebhook).toHaveBeenCalledWith(expect.objectContaining({ provider: 'mercado_pago', request: webhook }));
    expect(mocks.fetchTransaction).toHaveBeenCalledWith(connection, 'payment-2');
    expect(applyHubPayment).toHaveBeenCalledWith(expect.objectContaining({ externalReference: 'hub-ref', externalId: 'payment-2' }), expect.anything());
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

  it('dispatches push and email notifications in processWebhook without failing if email throws', async () => {
    const { processWebhook } = await import('@/lib/server/webhookHandler');
    const { ingestWebhook } = await import('@/lib/payments/ingest');
    const { getServiceClient } = await import('@/lib/server/session');
    vi.mocked(getServiceClient).mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { business_id: 'biz-1' }, error: null }) }) }) }),
    } as never);
    vi.mocked(ingestWebhook).mockResolvedValue({
      notify: true,
      transactionId: 'tx-99',
      notification: { amount: 2500, currency: 'ARS', provider: 'uala', occurredAt: '2026-11-23T12:00:00.000Z', storeId: 'store-1' },
    } as never);
    mocks.sendPaymentEmailToBusiness.mockRejectedValueOnce(new Error('smtp down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await processWebhook('uala', { headers: {}, query: {}, rawBody: '{}' });

    expect(res.transactionId).toBe('tx-99');
    expect(mocks.sendPushToBusiness).toHaveBeenCalledTimes(1);
    expect(mocks.sendPaymentEmailToBusiness).toHaveBeenCalledWith(
      { businessId: 'biz-1', storeId: 'store-1' },
      { transactionId: 'tx-99', amount: 2500, currency: 'ARS', provider: 'uala', occurredAt: '2026-11-23T12:00:00.000Z' },
    );
    errorSpy.mockRestore();
  });
});
