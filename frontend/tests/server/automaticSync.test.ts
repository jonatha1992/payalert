import { describe, expect, it, vi } from 'vitest';
import { runAutomaticSync, type AutomaticSyncDependencies, type AutomaticConnection } from '@/lib/payments/automaticSync';

const active = (id: string): AutomaticConnection => ({ id, businessId: `biz-${id}`, storeId: null,
  provider: 'mercado_pago', providerAccountId: `account-${id}`, status: 'CONNECTED', credentials: {},
  webhookSecret: null, lastSyncedAt: null });

function dependencies(overrides: Partial<AutomaticSyncDependencies> = {}): AutomaticSyncDependencies {
  return { listConnections: vi.fn(async () => [active('a'), active('b')]),
    syncConnection: vi.fn(async () => ({ checked: 1, newlyProcessed: 0, lastSyncAt: '2026-10-18T00:00:00.000Z', source: 'mercado_pago' as const })),
    now: () => 1000, maxConnections: 20, budgetMs: 10000, ...overrides };
}

describe('automatic Mercado Pago sync', () => {
  it('processes active connections independently and bounds a run', async () => {
    const deps = dependencies({ maxConnections: 1 });
    await expect(runAutomaticSync(deps)).resolves.toMatchObject({ selected: 1, succeeded: 1, failed: 0 });
    expect(deps.syncConnection).toHaveBeenCalledTimes(1);
  });

  it('isolates a failed connection so following connections run', async () => {
    const deps = dependencies({ syncConnection: vi.fn().mockRejectedValueOnce(new Error('failure'))
      .mockResolvedValueOnce({ checked: 1, newlyProcessed: 0, lastSyncAt: '', source: 'mercado_pago' }) });
    await expect(runAutomaticSync(deps)).resolves.toMatchObject({ succeeded: 1, failed: 1 });
    expect(deps.syncConnection).toHaveBeenCalledTimes(2);
  });

  it('uses a short lookback from each connection cursor', async () => {
    const deps = dependencies({ listConnections: vi.fn(async () => [{ ...active('a'), lastSyncedAt: '2026-10-17T23:00:00.000Z' }]) });
    const result = await runAutomaticSync(deps);
    expect(result).toMatchObject({ selected: 1 });
  });
});
