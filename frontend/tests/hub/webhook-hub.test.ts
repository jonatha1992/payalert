import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyHubPayment } from '@/lib/server/hubWebhook';

const mocks = vi.hoisted(() => ({
  row: { id: 'charge-1', client_app_id: 'app-1', booking_id: 'booking-1', external_reference: 'opaque-ref', amount: 1200, currency: 'ARS', preference_id: null, payment_id: null, status: 'pending', expires_at: '2030-01-01T00:00:00.000Z', idempotency_key: 'key', firestore_synced: false, last_error: null, client_apps: { id: 'app-1' } },
  update: vi.fn(),
  transition: vi.fn(async (_id: string, _from: string, to: string, patch: Record<string, unknown>) => { Object.assign(mocks.row, patch, { status: to }); return mocks.row; }),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/session', () => ({ getServiceClient: vi.fn() }));
vi.mock('@/lib/server/hubCharges', () => ({ transitionCharge: mocks.transition, hubChargeTransitions: { creating: ['pending'], pending: ['approved','rejected','expired','needs_refund'], approved: ['refunding'], refunding: ['approved','refunded'], rejected: [], expired: ['needs_refund'], needs_refund: [], refunded: [] } }));

function db() {
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: mocks.row, error: null }), update: (patch: Record<string, unknown>) => ({ eq: () => ({ then: (resolve: (value: { error: null }) => unknown) => { mocks.update(patch); return Promise.resolve(resolve({ error: null })); } }) }) };
  return { from: () => query } as never;
}
const payment = (changes: Record<string, unknown> = {}) => ({ externalReference: 'opaque-ref', externalId: 'mp-1', amount: 1200, currency: 'ARS', status: 'CONFIRMED' as const, ...changes });

beforeEach(() => { vi.resetAllMocks(); Object.assign(mocks.row, { status: 'pending', payment_id: null, firestore_synced: false, last_error: null, expires_at: '2030-01-01T00:00:00.000Z' }); mocks.transition.mockImplementation(async (_id: string, _from: string, to: string, patch: Record<string, unknown>) => { Object.assign(mocks.row, patch, { status: to }); return mocks.row; }); });

describe('hub Mercado Pago webhook handling', () => {
  it('confirms an unexpired hub charge without Firestore writes', async () => {
    await applyHubPayment(payment(), db());
    expect(mocks.row).toMatchObject({ status: 'approved', payment_id: 'mp-1' });
    expect(mocks.transition).toHaveBeenCalledWith('charge-1', 'pending', 'approved', { payment_id: 'mp-1', last_error: null });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('records amount or currency mismatches without confirming', async () => {
      await applyHubPayment(payment({ amount: 1201 }), db());
      expect(mocks.row.status).toBe('pending');
      expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ last_error: 'payment_amount_or_currency_mismatch' }));
      expect(mocks.transition).not.toHaveBeenCalled();
    });
  it('compares the provider payment against the stored charge amount and currency', async () => {
    mocks.row.amount = 3500;
    await applyHubPayment(payment({ amount: 3500 }), db());
    expect(mocks.row.status).toBe('approved');
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.transition).toHaveBeenCalledWith('charge-1', 'pending', 'approved', expect.any(Object));
  });
  it('marks a late approval needs_refund and never confirms the booking', async () => {
    mocks.row.expires_at = '2000-01-01T00:00:00.000Z';
    await applyHubPayment(payment(), db());
    expect(mocks.row.status).toBe('needs_refund');
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('rejects canceled payments and does not reopen terminal charges on replay', async () => {
    await applyHubPayment(payment({ status: 'REJECTED' }), db());
    expect(mocks.row.status).toBe('rejected');
    expect(mocks.transition).toHaveBeenCalledTimes(1);
    mocks.transition.mockClear();
    await applyHubPayment(payment(), db());
    expect(mocks.row.status).toBe('rejected');
    expect(mocks.transition).not.toHaveBeenCalled();
  });
});
