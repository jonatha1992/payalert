import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  apply: vi.fn(async () => {}),
  fetchTx: vi.fn(async (_c: unknown, id: string) => ({ externalReference: 'ref-1', externalId: id, amount: 5, currency: 'ARS', status: 'CONFIRMED' })),
  findConn: vi.fn(async () => ({ id: 'conn-1', provider: 'mercado_pago' })),
  row: { data: { credentials_encrypted: 'enc' } as { credentials_encrypted: string } | null, error: null },
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/hubWebhook', () => ({ applyHubPayment: mock.apply }));
vi.mock('@/lib/payments/secretBox', () => ({ decryptSecret: () => JSON.stringify({ access_token: 'tok' }) }));
vi.mock('@/lib/payments/connectors', () => ({ getConnector: () => ({ fetchTransaction: mock.fetchTx }) }));
vi.mock('@/lib/server/paymentsRepository', () => ({ SupabasePaymentsRepository: class { findConnectionById = mock.findConn; } }));
vi.mock('@/lib/server/session', () => ({ getServiceClient: () => ({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => mock.row }) }) }),
}) }));

import { activeCheckCharge } from '@/lib/server/hubActiveCheck';

const app = { id: 'app-1', connection_id: 'conn-1' } as never;
const charge = (id: string, status = 'pending') => ({ id, status, external_reference: 'ref-1' }) as never;
const okFetch = vi.fn(async () => new Response(JSON.stringify({ results: [{ id: 111 }] }), { status: 200 }));

describe('activeCheckCharge', () => {
  beforeEach(() => { mock.apply.mockClear(); okFetch.mockClear(); });

  it('feeds MP payments of a pending charge through applyHubPayment', async () => {
    expect(await activeCheckCharge(app, charge('c1'), { fetchImpl: okFetch as never, now: () => 1e12 })).toBe(true);
    expect(okFetch.mock.calls[0][0]).toContain('external_reference=ref-1');
    expect(mock.apply).toHaveBeenCalledWith(expect.objectContaining({ externalId: '111', status: 'CONFIRMED' }), expect.anything());
  });

  it('is rate limited per charge', async () => {
    await activeCheckCharge(app, charge('c2'), { fetchImpl: okFetch as never, now: () => 1e12 });
    expect(await activeCheckCharge(app, charge('c2'), { fetchImpl: okFetch as never, now: () => 1e12 + 5_000 })).toBe(false);
    expect(okFetch).toHaveBeenCalledTimes(1);
  });

  it('skips non pending charges and empty results', async () => {
    expect(await activeCheckCharge(app, charge('c3', 'approved'), { fetchImpl: okFetch as never })).toBe(false);
    const empty = vi.fn(async () => new Response(JSON.stringify({ results: [] }), { status: 200 }));
    expect(await activeCheckCharge(app, charge('c4'), { fetchImpl: empty as never, now: () => 2e12 })).toBe(false);
    expect(mock.apply).not.toHaveBeenCalled();
  });
});
