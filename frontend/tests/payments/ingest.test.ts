import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ingestWebhook, type PaymentsRepository } from '@/lib/payments/ingest';
import { MercadoPagoConnector } from '@/lib/payments/connectors/mercadopago';
import { UalaConnector } from '@/lib/payments/connectors/uala';
import { ProviderError } from '@/lib/payments/connectors/errors';
import type { ExpectedPayment, NormalizedTransaction, PaymentConnection, PaymentConnector, Provider,
  WebhookRequest } from '@/lib/payments/types';

const now = () => Date.parse('2026-01-01T12:00:00Z');
const connection = (id: string, account: string): PaymentConnection => ({ id, provider: 'mercado_pago',
  businessId: `business-${id}`, storeId: `store-${id}`, providerAccountId: account, status: 'CONNECTED',
  credentials: { access_token: `private-token-${id}` }, webhookSecret: `private-secret-${id}` });
const a = connection('A', '1');
const b = connection('B', '2');
const transaction = (changes: Partial<NormalizedTransaction> = {}): NormalizedTransaction => ({ provider: 'mercado_pago',
  externalId: 'payment', providerAccountId: '2', direction: 'IN', amount: 100, currency: 'ARS', status: 'CONFIRMED',
  occurredAt: new Date(now()).toISOString(), payerName: 'Private Person', payerIdentifier: 'DNI 123',
  description: null, externalReference: null, raw: {}, ...changes });
const expected = (id: string, changes: Partial<ExpectedPayment> = {}): ExpectedPayment => ({ id,
  businessId: b.businessId, storeId: b.storeId, amount: 100, currency: 'ARS', reference: null,
  status: 'WAITING', createdAt: '2026-01-01T11:59:00Z', expiresAt: '2026-01-01T12:30:00Z',
  provider: 'mercado_pago', providerOrderId: null, checkoutUrl: null, ...changes });

function request(account = '2', changes: Partial<WebhookRequest> = {}): WebhookRequest {
  const ts = String(now() / 1000);
  const hash = createHmac('sha256', b.webhookSecret!).update(`id:payment;request-id:r;ts:${ts};`).digest('hex');
  return { rawBody: JSON.stringify({ type: 'payment', data: { id: 'payment' }, user_id: account }), query: {},
    headers: { 'x-request-id': 'r', 'x-signature': `ts=${ts},v1=${hash}` }, ...changes };
}

class MemoryRepository implements PaymentsRepository {
  connections = [structuredClone(a), structuredClone(b)];
  orders = new Map<string, PaymentConnection>();
  rows = new Map<string, { id: string; businessId: string; storeId: string | null; tx: NormalizedTransaction }>();
  logs: Parameters<PaymentsRepository['logWebhook']>[0][] = [];
  audits: Parameters<PaymentsRepository['audit']>[0][] = [];
  expected: ExpectedPayment[] = [];
  marked: { id: string; status: string; transactionId: string }[] = [];
  async findConnectionByProviderAccount(provider: Provider, account: string) {
    return this.connections.find((c) => c.provider === provider && c.providerAccountId === account) ?? null;
  }
  async findConnectionByOrder(provider: Provider, order: string) {
    const result = this.orders.get(order);
    return result?.provider === provider ? result : null;
  }
  async findConnectionById(id: string) { return this.connections.find((c) => c.id === id) ?? null; }
  async upsertTransaction(...[businessId, storeId, tx, canTransition]: Parameters<PaymentsRepository['upsertTransaction']>) {
    const key = `${tx.provider}:${tx.externalId}`;
    const previous = this.rows.get(key);
    if (previous && previous.businessId !== businessId) throw new Error('Tenant conflict');
    const result = { id: previous?.id ?? `tx-${this.rows.size + 1}`, created: !previous,
      previousStatus: previous?.tx.status ?? null };
    // No await between reading and writing: the fake models an atomic repository operation.
    if (!previous || canTransition(previous.tx.status, tx.status)) {
      this.rows.set(key, { id: result.id, businessId, storeId, tx: structuredClone(tx) });
    }
    return result;
  }
  async listOpenExpectedPayments(businessId: string, storeId?: string | null) {
    return this.expected.filter((e) => e.businessId === businessId &&
      (storeId == null || e.storeId === storeId) && e.status === 'WAITING');
  }
  async markExpectedPayment(id: string, status: ExpectedPayment['status'], transactionId: string) {
    this.marked.push({ id, status, transactionId });
    const item = this.expected.find((e) => e.id === id);
    if (item) item.status = status;
  }
  async logWebhook(entry: Parameters<PaymentsRepository['logWebhook']>[0]) { this.logs.push(entry); }
  async audit(entry: Parameters<PaymentsRepository['audit']>[0]) { this.audits.push(entry); }
}

function setup() {
  const repo = new MemoryRepository();
  const connector = new MercadoPagoConnector(vi.fn());
  const fetchTransaction = vi.spyOn(connector, 'fetchTransaction').mockResolvedValue(transaction());
  const run = (req = request(), provider: Provider = 'mercado_pago', adapter: PaymentConnector = connector) =>
    ingestWebhook({ provider, request: req, repo, connectorFactory: () => adapter, now });
  return { repo, connector, fetchTransaction, run };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now()); });
afterEach(() => vi.useRealTimers());

describe('webhook ingestion', () => {
  it('routes account B only to business B even though A is the first connection', async () => {
    const { repo, run, fetchTransaction } = setup();
    expect(await run()).toMatchObject({ httpStatus: 200, outcome: 'processed', notify: true,
      notification: { amount: 100, currency: 'ARS', occurredAt: transaction().occurredAt,
        storeId: b.storeId, provider: 'mercado_pago' } });
    expect([...repo.rows.values()][0].businessId).toBe(b.businessId);
    expect(fetchTransaction).toHaveBeenCalledWith(b, 'payment');
    expect(repo.logs[0]).toMatchObject({ status: 'processed', businessId: b.businessId });
  });

  it('acknowledges unknown accounts without guessing, including a misleading connection hint', async () => {
    const { repo, run, fetchTransaction } = setup();
    const queries: Record<string, string>[] = [{}, { connection: 'A' }];
    for (const query of queries) {
      expect(await run(request('unknown', { query }))).toEqual({ httpStatus: 200, outcome: 'unmatched' });
    }
    expect(repo.rows.size).toBe(0);
    expect(fetchTransaction).not.toHaveBeenCalled();
    expect(repo.logs.every((entry) => entry.status === 'unmatched')).toBe(true);
  });

  it('rejects conflicting or wrong-provider hints and allows a matching hint', async () => {
    const { repo, run } = setup();
    repo.connections.push({ ...a, id: 'uala', provider: 'uala' });
    for (const hint of ['A', 'uala', 'missing']) {
      expect(await run(request('2', { query: { connection: hint } }))).toMatchObject({ outcome: 'unmatched' });
    }
    expect(await run(request('2', { query: { connection: 'B' } }))).toMatchObject({ notify: true });
    expect([...repo.rows.values()].every((row) => row.businessId === b.businessId)).toBe(true);
  });

  it('produces one row and one notification for sequential and concurrent duplicates', async () => {
    const { repo, run } = setup();
    const results = await Promise.all([run(), run(), run()]);
    results.push(await run());
    expect(results.filter((r) => r.notify).length).toBe(1);
    expect(repo.rows.size).toBe(1);
    expect(repo.audits).toHaveLength(1);
    const payload = results.find((r) => r.notify)!.notification!;
    expect(Object.keys(payload).sort()).toEqual(['amount', 'currency', 'occurredAt', 'provider', 'storeId']);
    expect(JSON.stringify(payload)).not.toContain('Private Person');
  });

  it('confirms a pending payment once, blocks regressions and persists a reversal', async () => {
    const { repo, run, fetchTransaction } = setup();
    const statuses = ['PENDING', 'CONFIRMED', 'PENDING', 'CONFIRMED', 'REVERSED', 'CONFIRMED'] as const;
    const results = [];
    for (const status of statuses) {
      fetchTransaction.mockResolvedValueOnce(transaction({ status }));
      results.push(await run());
      const saved = [...repo.rows.values()][0].tx.status;
      if (results.length >= 5) expect(saved).toBe('REVERSED');
      else if (results.length >= 2) expect(saved).toBe('CONFIRMED');
      else expect(saved).toBe('PENDING');
    }
    expect(results.map((r) => Boolean(r.notify))).toEqual([false, true, false, false, false, false]);
  });

  it('moves pending to rejected and prevents rejected payments from reopening', async () => {
    const { repo, run, fetchTransaction } = setup();
    for (const status of ['PENDING', 'REJECTED', 'CONFIRMED'] as const) {
      fetchTransaction.mockResolvedValueOnce(transaction({ status }));
      expect((await run()).notify).not.toBe(true);
    }
    expect([...repo.rows.values()][0].tx.status).toBe('REJECTED');
  });

  it.each(['missing', 'bad'])('returns 401 for %s secrets/signatures before fetching', async (mode) => {
    const { repo, run, fetchTransaction } = setup();
    if (mode === 'missing') repo.connections[1].webhookSecret = null;
    expect(await run(mode === 'bad' ? request('2', { headers: { 'x-signature': 'ts=1,v1=bad' } }) : request()))
      .toMatchObject({ httpStatus: 401, outcome: 'invalid' });
    expect(fetchTransaction).not.toHaveBeenCalled();
    expect(repo.logs[0].status).toBe('invalid');
  });

  it('logs ignored notifications without fetching', async () => {
    const { repo, run, fetchTransaction } = setup();
    expect(await run(request('2', { rawBody: JSON.stringify({ user_id: 2, type: 'merchant_order' }) })))
      .toMatchObject({ httpStatus: 200, outcome: 'ignored' });
    expect(repo.logs[0].status).toBe('ignored');
    expect(fetchTransaction).not.toHaveBeenCalled();
  });

  it('does not persist a fetched account mismatch', async () => {
    const { repo, run, fetchTransaction } = setup();
    fetchTransaction.mockResolvedValueOnce(transaction({ providerAccountId: '1' }));
    expect(await run()).toMatchObject({ httpStatus: 200, outcome: 'invalid' });
    expect(repo.rows.size).toBe(0);
    expect(repo.logs[0]).toMatchObject({ status: 'invalid', reason: 'account mismatch' });
  });

  it.each([[503, 500], [429, 500], [404, 200], [401, 200]])('handles provider status %i with HTTP %i', async (status, httpStatus) => {
    const { repo, run, fetchTransaction } = setup();
    fetchTransaction.mockRejectedValueOnce(new ProviderError('mercado_pago', status));
    expect(await run()).toMatchObject({ httpStatus, outcome: 'failed' });
    expect(repo.rows.size).toBe(0);
    expect(repo.logs[0].status).toBe('failed');
  });

  it('never logs credentials, request content, signature, payer data or exception messages', async () => {
    const { repo, run, fetchTransaction } = setup();
    const poison = [a.credentials.access_token, b.credentials.access_token, a.webhookSecret!, b.webhookSecret!];
    const req = request('2', { query: { token: poison.join(',') } });
    req.rawBody = JSON.stringify({ ...JSON.parse(req.rawBody), secrets: poison });
    fetchTransaction.mockRejectedValueOnce(new Error(poison.join(',')));
    expect(await run(req)).toMatchObject({ httpStatus: 500, outcome: 'failed' });
    await run(req);
    await run(request('unknown'));
    await run(request('2', { headers: {} }));
    for (const entry of [...repo.logs, ...repo.audits]) {
      for (const value of [...poison, 'Private Person', 'DNI 123', req.headers['x-signature']]) {
        expect(JSON.stringify(entry)).not.toContain(value);
      }
    }
  });

  it('resolves Uala by order and fetches the truth instead of trusting webhook status', async () => {
    const { repo, run } = setup();
    const uala = { ...b, provider: 'uala' as const, providerAccountId: null };
    repo.connections.push(uala);
    repo.orders.set('order', uala);
    const connector = new UalaConnector(vi.fn());
    const fetchTransaction = vi.spyOn(connector, 'fetchTransaction').mockResolvedValue(
      transaction({ provider: 'uala', externalId: 'order', providerAccountId: null, status: 'PENDING' }));
    expect(await run({ rawBody: JSON.stringify({ uuid: 'order', status: 'APPROVED' }), headers: {}, query: {} }, 'uala', connector))
      .toMatchObject({ httpStatus: 200, outcome: 'processed' });
    expect(fetchTransaction).toHaveBeenCalledWith(uala, 'order');
    expect([...repo.rows.values()][0].tx.status).toBe('PENDING');
    expect(await run({ rawBody: '{"uuid":"unknown"}', headers: {}, query: {} }, 'uala', connector))
      .toEqual({ httpStatus: 200, outcome: 'unmatched' });
  });

  it('matches only expected payments in the owning business and store', async () => {
    const { repo, run } = setup();
    repo.expected = [expected('foreign', { businessId: a.businessId }), expected('other-store', { storeId: 'other' }), expected('e')];
    expect(await run()).toMatchObject({ match: { decision: 'AUTO', expectedPaymentId: 'e' } });
    expect(repo.marked).toEqual([{ id: 'e', status: 'MATCHED', transactionId: 'tx-1' }]);
  });

  it('marks ambiguity for manual review and lets a reference beat ambiguity', async () => {
    const ambiguous = setup();
    ambiguous.repo.expected = [expected('e1'), expected('e2')];
    expect(await ambiguous.run()).toMatchObject({ match: { decision: 'MANUAL_REVIEW' } });
    expect(ambiguous.repo.marked.map((m) => m.status)).toEqual(['MANUAL_REVIEW', 'MANUAL_REVIEW']);
    const referenced = setup();
    referenced.repo.expected = [expected('e1'), expected('e2')];
    referenced.fetchTransaction.mockResolvedValueOnce(transaction({ externalReference: 'e2' }));
    expect(await referenced.run()).toMatchObject({ match: { decision: 'AUTO', expectedPaymentId: 'e2' } });
    expect(referenced.repo.marked).toEqual([{ id: 'e2', status: 'MATCHED', transactionId: 'tx-1' }]);
  });
});
