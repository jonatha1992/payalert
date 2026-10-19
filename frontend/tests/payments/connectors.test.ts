import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MercadoPagoConnector } from '@/lib/payments/connectors/mercadopago';
import { UalaConnector } from '@/lib/payments/connectors/uala';
import { MockConnector } from '@/lib/payments/connectors/mock';
import { getConnector } from '@/lib/payments/connectors';
import { ProviderError } from '@/lib/payments/connectors/errors';
import type { CreateChargeInput, NormalizedTransaction, PaymentConnection, WebhookRequest } from '@/lib/payments/types';

const connection: PaymentConnection = { id: 'c', provider: 'mercado_pago', businessId: 'b', storeId: 's',
  providerAccountId: '22', status: 'CONNECTED', credentials: { access_token: 'private-token' },
  webhookSecret: 'private-secret' };
const now = new Date('2026-01-01T12:00:00Z');
const ts = String(now.getTime() / 1000);
function request(body: unknown, query: Record<string, string> = {}, signedId = '12'): WebhookRequest {
  const hash = createHmac('sha256', 'private-secret').update(`id:${signedId};request-id:r;ts:${ts};`).digest('hex');
  return { rawBody: JSON.stringify(body), query,
    headers: { 'x-request-id': 'r', 'x-signature': `ts=${ts},v1=${hash}` } };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const charge: CreateChargeInput = { amount: 10.9, currency: 'ARS', expectedPaymentId: 'e', description: 'Order',
  notificationUrl: 'https://example.com/hook', successUrl: 'https://example.com/ok', failureUrl: 'https://example.com/fail' };
afterEach(() => vi.useRealTimers());

describe('Mercado Pago connector', () => {
  it('accepts payment notifications with query precedence and body fallback', () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const connector = new MercadoPagoConnector(vi.fn());
    expect(connector.parseWebhook(request({ data: { id: 'wrong' }, type: 'wrong', user_id: 22 },
      { 'data.id': '12', type: 'payment' }), connection)).toMatchObject({ kind: 'accepted', externalId: '12',
      providerAccountId: '22', providerOrderId: null });
    expect(connector.parseWebhook(request({ data: { id: 12 }, topic: 'payment' }), connection).kind).toBe('accepted');
    expect('createCharge' in connector).toBe(false);
  });

  it('usa la clave secreta de la app (MP_WEBHOOK_SECRET) para conexiones OAuth sin clave propia', () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const connector = new MercadoPagoConnector(vi.fn());
    const oauth = { ...connection, webhookSecret: null };
    const signed = request({ type: 'payment', data: { id: 12 }, user_id: 22 });
    vi.stubEnv('MP_WEBHOOK_SECRET', '');
    expect(connector.parseWebhook(signed, oauth)).toEqual({ kind: 'rejected', reason: 'missing_secret' });
    vi.stubEnv('MP_WEBHOOK_SECRET', 'private-secret');
    expect(connector.parseWebhook(signed, oauth).kind).toBe('accepted');
    vi.stubEnv('MP_WEBHOOK_SECRET', 'otra-clave');
    expect(connector.parseWebhook(signed, oauth).kind).toBe('rejected');
    vi.unstubAllEnvs();
  });

  it('ignores unrelated events and rejects missing IDs, malformed bodies, secrets and signatures', () => {
    const connector = new MercadoPagoConnector(vi.fn());
    expect(connector.parseWebhook(request({ type: 'merchant_order' }), connection).kind).toBe('ignored');
    expect(connector.parseWebhook(request({ type: 'payment' }), connection).kind).toBe('rejected');
    expect(connector.parseWebhook({ ...request({}), rawBody: '{' }, connection).kind).toBe('rejected');
    for (const conn of [null, { ...connection, webhookSecret: null }]) {
      expect(connector.parseWebhook(request({ type: 'payment', data: { id: 12 } }), conn))
        .toEqual({ kind: 'rejected', reason: 'missing_secret' });
    }
    vi.useFakeTimers(); vi.setSystemTime(now);
    const valid = request({ type: 'payment', data: { id: 12 } });
    expect(connector.parseWebhook({ ...valid, headers: {} }, connection).kind).toBe('rejected');
    expect(connector.parseWebhook({ ...valid, headers: { 'x-signature': 'ts=1,v1=bad' } }, connection).kind).toBe('rejected');
    vi.setSystemTime(now.getTime() + 601_000);
    expect(connector.parseWebhook(valid, connection)).toEqual({ kind: 'rejected', reason: 'timestamp_out_of_tolerance' });
  });

  it('fetches authoritative payments with the connection bearer and checks health', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ id: 12, transaction_amount: 20, status: 'approved' }))
      .mockResolvedValueOnce(json({ id: 22 }));
    const connector = new MercadoPagoConnector(fetchImpl);
    expect(await connector.fetchTransaction(connection, '12')).toMatchObject({ amount: 20, status: 'CONFIRMED' });
    expect(fetchImpl).toHaveBeenNthCalledWith(1, 'https://api.mercadopago.com/v1/payments/12',
      expect.objectContaining({ method: 'GET', headers: { Authorization: 'Bearer private-token' } }));
    expect(await connector.healthCheck(connection)).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenNthCalledWith(2, 'https://api.mercadopago.com/users/me',
      expect.objectContaining({ method: 'GET', headers: { Authorization: 'Bearer private-token' } }));
  });

  it.each([[429, true], [503, true], [401, false], [404, false]])('classifies HTTP %i without leaking response bodies', async (status, retriable) => {
    const connector = new MercadoPagoConnector(vi.fn<typeof fetch>().mockResolvedValue(json({ secret: 'private-token' }, status)));
    const error = await connector.fetchTransaction(connection, '12').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ provider: 'mercado_pago', status, retriable });
    expect(String(error)).not.toContain('private-token');
    expect(await connector.healthCheck(connection)).toMatchObject({ ok: false });
  });
});

describe('Uala connector', () => {
  const uala: PaymentConnection = { ...connection, provider: 'uala', providerAccountId: null,
    credentials: { username: 'u', client_id: 'c', client_secret_id: 'secret' } };
  it('accepts unsigned order IDs only', () => {
    const connector = new UalaConnector(vi.fn());
    expect(connector.parseWebhook(request({ uuid: 'order' }), null)).toMatchObject({ kind: 'accepted',
      externalId: 'order', providerOrderId: 'order', providerAccountId: null });
    expect(connector.parseWebhook(request({}), null).kind).toBe('rejected');
    expect(connector.parseWebhook({ ...request({}), rawBody: 'null' }, null).kind).toBe('rejected');
  });

  it.each(['production', 'stage'])('uses %s auth and order URLs with authenticated GET', async (environment) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ access_token: 'uala-token' }))
      .mockResolvedValueOnce(json({ uuid: 'order', amount: 1001, status: 'PROCESSED' }));
    const connector = new UalaConnector(fetchImpl);
    expect(await connector.fetchTransaction({ ...uala, credentials: { ...uala.credentials, environment } }, 'order'))
      .toMatchObject({ amount: 1001, status: 'CONFIRMED' });
    const stage = environment === 'stage' ? '.stage' : '';
    expect(fetchImpl).toHaveBeenNthCalledWith(1, `https://auth${stage}.developers.ar.ua.la/v2/api/auth/token`,
      expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/json' } }));
    expect(JSON.parse(fetchImpl.mock.calls[0][1]!.body as string)).toEqual({ username: 'u', client_id: 'c',
      client_secret_id: 'secret', grant_type: 'client_credentials' });
    expect(fetchImpl).toHaveBeenNthCalledWith(2, `https://checkout${stage}.developers.ar.ua.la/v2/api/orders/order`,
      expect.objectContaining({ method: 'GET', headers: { Authorization: 'Bearer uala-token' } }));
  });

  it.each([['true', '1090'], ['false', '10.90'], ['', '10.90']])('creates checkout using amount_in_cents=%s', async (flag, amount) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ access_token: 'uala-token' }))
      .mockResolvedValueOnce(json({ uuid: 'order', links: { checkout_link: 'https://checkout.example/order' } }));
    const connector = new UalaConnector(fetchImpl);
    expect(await connector.createCharge({ ...uala, credentials: { ...uala.credentials, amount_in_cents: flag } }, charge))
      .toEqual({ providerOrderId: 'order', checkoutUrl: 'https://checkout.example/order' });
    expect(fetchImpl.mock.calls[1][0]).toBe('https://checkout.developers.ar.ua.la/v2/api/checkout');
    expect(fetchImpl.mock.calls[1][1]).toMatchObject({ method: 'POST',
      headers: { Authorization: 'Bearer uala-token', 'Content-Type': 'application/json' } });
    expect(JSON.parse(fetchImpl.mock.calls[1][1]!.body as string)).toEqual({ amount, description: 'Order',
      external_reference: 'e', callback_fail: charge.failureUrl, callback_success: charge.successUrl,
      notification_url: charge.notificationUrl });
  });

  it('checks token success and reports token/order HTTP errors', async () => {
    expect(await new UalaConnector(vi.fn<typeof fetch>().mockResolvedValue(json({ access_token: 'token' })))
      .healthCheck(uala)).toEqual({ ok: true });
    const unauthorized = new UalaConnector(vi.fn<typeof fetch>().mockResolvedValue(json({}, 401)));
    expect(await unauthorized.healthCheck(uala)).toMatchObject({ ok: false });
    await expect(unauthorized.fetchTransaction(uala, 'o')).rejects.toMatchObject({ provider: 'uala', status: 401, retriable: false });
    const failing = new UalaConnector(vi.fn<typeof fetch>().mockResolvedValueOnce(json({ access_token: 'token' }))
      .mockResolvedValueOnce(json({}, 503)));
    await expect(failing.fetchTransaction(uala, 'o')).rejects.toMatchObject({ status: 503, retriable: true });
    expect(await new UalaConnector(vi.fn<typeof fetch>().mockResolvedValue(json({}))).healthCheck(uala))
      .toMatchObject({ ok: false });
  });
});

describe('mock connector and registry', () => {
  it('simulates income, duplicate, rejection and reversal by seeding authoritative states', async () => {
    const connector = new MockConnector(vi.fn());
    const tx: NormalizedTransaction = { provider: 'mock', externalId: 'p', providerAccountId: null,
      direction: 'IN', amount: 10, currency: 'ARS', status: 'CONFIRMED', occurredAt: now.toISOString(),
      payerName: null, payerIdentifier: null, description: null, externalReference: null, raw: {} };
    connector.seed(tx);
    expect(connector.parseWebhook(request({ externalId: 'p' }), null)).toMatchObject({ kind: 'accepted', externalId: 'p' });
    expect(await connector.fetchTransaction(connection, 'p')).toEqual(tx);
    expect(await connector.fetchTransaction(connection, 'p')).toEqual(tx);
    for (const status of ['REJECTED', 'REVERSED'] as const) {
      connector.seed({ ...tx, status });
      expect((await connector.fetchTransaction(connection, 'p')).status).toBe(status);
    }
    await expect(connector.fetchTransaction(connection, 'missing')).rejects.toMatchObject({ status: 404 });
    expect(connector.parseWebhook(request({}), null).kind).toBe('rejected');
    expect(await connector.healthCheck(connection)).toEqual({ ok: true });
  });

  it('returns a connector for every provider and keeps mock state on the registry instance', () => {
    expect(getConnector('mercado_pago')).toBeInstanceOf(MercadoPagoConnector);
    expect(getConnector('uala')).toBeInstanceOf(UalaConnector);
    expect(getConnector('mock')).toBeInstanceOf(MockConnector);
    expect(getConnector('mock')).toBe(getConnector('mock'));
  });
});
