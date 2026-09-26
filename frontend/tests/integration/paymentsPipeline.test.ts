/**
 * Integration test against a real Postgres + PostgREST (docker). Skipped unless PAYMENTS_IT_URL is set.
 *   PAYMENTS_IT_URL=http://localhost:55433 PAYMENTS_IT_KEY=<service_role JWT> npx vitest run tests/integration
 */
import { randomBytes } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { MockConnector } from '@/lib/payments/connectors/mock';
import { ingestWebhook } from '@/lib/payments/ingest';
import { encryptSecret } from '@/lib/payments/secretBox';
import type { MovementStatus, NormalizedTransaction } from '@/lib/payments/types';
import { SupabasePaymentsRepository } from '@/lib/server/paymentsRepository';

const url = process.env.PAYMENTS_IT_URL;
const key = process.env.PAYMENTS_IT_KEY;
const run = url && key ? describe : describe.skip;

const BIZ_A = '0000000a-0000-4000-8000-000000000001';
const BIZ_B = '0000000b-0000-4000-8000-000000000001';

run('payments pipeline on real Postgres', () => {
  let db: SupabaseClient;
  let repo: SupabasePaymentsRepository;
  const mock = new MockConnector();
  let connA: string;
  let connB: string;

  const tx = (externalId: string, status: MovementStatus, amount = 1500): NormalizedTransaction => ({
    provider: 'mock', externalId, providerAccountId: null, direction: 'IN', amount, currency: 'ARS', status,
    occurredAt: new Date().toISOString(), payerName: 'Juan', payerIdentifier: null, description: 'test',
    externalReference: null, raw: { simulated: true },
  });

  const deliver = (connection: string, externalId: string) =>
    ingestWebhook({
      provider: 'mock',
      request: { headers: {}, query: { connection }, rawBody: JSON.stringify({ externalId }) },
      repo,
      connectorFactory: () => mock,
    });

  beforeAll(async () => {
    process.env.PAYMENTS_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    db = createClient(url!, key!, { auth: { persistSession: false } });
    // PostgREST without the Supabase gateway: supabase-js appends /rest/v1, so point it straight at PostgREST.
    (db as unknown as { rest: { url: string } }).rest.url = url!;
    repo = new SupabasePaymentsRepository(db);

    for (const table of ['expected_payments', 'transactions', 'payment_connections', 'webhook_logs', 'audit_logs']) {
      await db.from(table).delete().in('business_id', [BIZ_A, BIZ_B]);
    }
    await db.from('businesses').upsert([{ id: BIZ_A, name: 'A' }, { id: BIZ_B, name: 'B' }]);
    const creds = encryptSecret('{}');
    const { data, error } = await db
      .from('payment_connections')
      .insert([
        { business_id: BIZ_A, provider: 'mock', status: 'CONNECTED', credentials_encrypted: creds },
        { business_id: BIZ_B, provider: 'mock', status: 'CONNECTED', credentials_encrypted: creds },
      ])
      .select('id, business_id');
    if (error) throw error;
    connA = data!.find((r) => r.business_id === BIZ_A)!.id;
    connB = data!.find((r) => r.business_id === BIZ_B)!.id;
  });

  it('stores a confirmed payment once, even with duplicate deliveries', async () => {
    mock.seed(tx('it-dup', 'CONFIRMED'));
    const first = await deliver(connA, 'it-dup');
    const second = await deliver(connA, 'it-dup');
    expect(first.outcome).toBe('processed');
    expect(first.notify).toBe(true);
    expect(second.outcome).toBe('duplicate');
    expect(second.notify).toBeFalsy();
    const { count } = await db.from('transactions').select('id', { count: 'exact', head: true }).eq('external_id', 'it-dup');
    expect(count).toBe(1);
  });

  it('20 concurrent deliveries still produce one row and one notification', async () => {
    mock.seed(tx('it-race', 'CONFIRMED'));
    const results = await Promise.all(Array.from({ length: 20 }, () => deliver(connA, 'it-race')));
    const { count } = await db.from('transactions').select('id', { count: 'exact', head: true }).eq('external_id', 'it-race');
    expect(count).toBe(1);
    expect(results.filter((r) => r.notify).length).toBe(1);
  });

  it('pending -> confirmed notifies once; a late pending never regresses; reversal is recorded', async () => {
    mock.seed(tx('it-flow', 'PENDING'));
    expect((await deliver(connA, 'it-flow')).notify).toBeFalsy();
    mock.seed(tx('it-flow', 'CONFIRMED'));
    expect((await deliver(connA, 'it-flow')).notify).toBe(true);
    mock.seed(tx('it-flow', 'PENDING'));
    await deliver(connA, 'it-flow');
    let row = await db.from('transactions').select('provider_status, status').eq('external_id', 'it-flow').single();
    expect(row.data).toEqual({ provider_status: 'CONFIRMED', status: 'completed' });
    mock.seed(tx('it-flow', 'REVERSED'));
    await deliver(connA, 'it-flow');
    row = await db.from('transactions').select('provider_status, status').eq('external_id', 'it-flow').single();
    expect(row.data).toEqual({ provider_status: 'REVERSED', status: 'reversed' });
  });

  it('the same external id cannot be claimed by another business', async () => {
    mock.seed(tx('it-dup', 'CONFIRMED'));
    const result = await deliver(connB, 'it-dup');
    expect(result.outcome).toBe('failed');
    const { data } = await db.from('transactions').select('business_id').eq('external_id', 'it-dup');
    expect(data).toEqual([{ business_id: BIZ_A }]);
  });

  it('auto-matches a unique expected payment, and sends ambiguous ones to manual review', async () => {
    const exp = await db
      .from('expected_payments')
      .insert({ business_id: BIZ_A, amount: 777, currency: 'ARS', expires_at: new Date(Date.now() + 600_000).toISOString() })
      .select('id')
      .single();
    mock.seed(tx('it-match', 'CONFIRMED', 777));
    const result = await deliver(connA, 'it-match');
    expect(result.match?.decision).toBe('AUTO');
    const after = await db.from('expected_payments').select('status, matched_transaction_id').eq('id', exp.data!.id).single();
    expect(after.data).toEqual({ status: 'MATCHED', matched_transaction_id: 'mock_it-match' });

    const twins = await db
      .from('expected_payments')
      .insert([1, 2].map(() => ({ business_id: BIZ_A, amount: 888, currency: 'ARS', expires_at: new Date(Date.now() + 600_000).toISOString() })))
      .select('id');
    mock.seed(tx('it-ambig', 'CONFIRMED', 888));
    const ambiguous = await deliver(connA, 'it-ambig');
    expect(ambiguous.match?.decision).toBe('MANUAL_REVIEW');
    const states = await db.from('expected_payments').select('status').in('id', twins.data!.map((r) => r.id));
    expect(states.data!.map((r) => r.status)).toEqual(['MANUAL_REVIEW', 'MANUAL_REVIEW']);
  });

  it('writes webhook logs without provider payloads or secrets', async () => {
    const { data } = await db.from('webhook_logs').select('payload').eq('business_id', BIZ_A).limit(50);
    expect(data!.length).toBeGreaterThan(0);
    for (const row of data!) {
      expect(Object.keys(row.payload).sort()).toEqual(['connection_id', 'outcome', 'provider_status', 'received_at']);
    }
  });
});
