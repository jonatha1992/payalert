import { describe, expect, it, vi } from 'vitest';
import { syncConnectionPayments, type SyncDependencies } from '@/lib/payments/manualSync';
import type { NormalizedTransaction, PaymentConnection } from '@/lib/payments/types';

const connection: PaymentConnection = { id: 'c1', businessId: 'biz1', storeId: 's1', provider: 'mercado_pago',
  providerAccountId: 'account1', status: 'CONNECTED', credentials: { access_token: 'secret-token' }, webhookSecret: null };
const tx: NormalizedTransaction = { provider: 'mercado_pago', externalId: 'p1', providerAccountId: 'account1',
  direction: 'IN', amount: 25, currency: 'ARS', status: 'CONFIRMED', occurredAt: '2026-10-16T12:00:00.000Z',
  payerName: null, payerIdentifier: null, description: null, externalReference: null, raw: {} };

function setup() {
  const rows = new Set<string>();
  const dependencies: SyncDependencies = {
    listTransactions: vi.fn(async () => [tx]),
    ingest: vi.fn(async (_connection, payment) => {
      const key = `${payment.provider}:${payment.externalId}`;
      if (rows.has(key)) return 'duplicate' as const;
      rows.add(key);
      return 'processed' as const;
    }),
    recordFreshness: vi.fn(async () => undefined),
    audit: vi.fn(async () => undefined),
    log: vi.fn(),
    now: () => new Date('2026-10-16T12:01:00.000Z'),
  };
  return dependencies;
}

describe('manual provider sync', () => {
  it('ingests provider-listed transactions idempotently on repeated runs and records freshness', async () => {
    const deps = setup();
    expect(await syncConnectionPayments(connection, deps)).toMatchObject({ newlyProcessed: 1, checked: 1 });
    expect(await syncConnectionPayments(connection, deps)).toMatchObject({ newlyProcessed: 0, checked: 1 });
    expect(deps.ingest).toHaveBeenCalledTimes(2);
    expect(deps.recordFreshness).toHaveBeenCalledTimes(2);
  });

  it('does not mark freshness or report confirmed payments when provider lookup fails', async () => {
    const deps = setup();
    vi.mocked(deps.listTransactions).mockRejectedValueOnce(new Error('secret-token provider failure'));
    await expect(syncConnectionPayments(connection, deps)).rejects.toThrow();
    expect(deps.recordFreshness).not.toHaveBeenCalled();
    expect(deps.log).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'provider_error' }));
    expect(JSON.stringify(vi.mocked(deps.log).mock.calls)).not.toContain('secret-token');
  });
});
