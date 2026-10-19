import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyHubPayment } from '@/lib/server/hubWebhook';

const mocks = vi.hoisted(() => ({
  row: { id: 'charge-1', client_app_id: 'app-1', booking_id: 'booking-1', external_reference: 'opaque-ref', amount: 1200, currency: 'ARS', preference_id: null, payment_id: null, status: 'pending', expires_at: '2030-01-01T00:00:00.000Z', idempotency_key: 'key', firestore_synced: false, last_error: null, client_apps: { id: 'app-1' } },
  booking: { status: 'pendiente' }, updateBooking: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/session', () => ({ getServiceClient: vi.fn() }));
vi.mock('@/lib/server/firebaseAdmin', () => ({ firebaseForClientApp: () => ({ firestore: { collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => mocks.booking }), update: mocks.updateBooking }) }) } }) }));

function db() {
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: mocks.row, error: null }),
    update: (patch: Record<string, unknown>) => ({ eq: (_key: string, value: string) => ({
      eq: (_status: string, status: string) => ({ select: () => ({ maybeSingle: async () => {
        if (value !== mocks.row.id || status !== 'pending' || mocks.row.status !== 'pending') return { data: null, error: null };
        Object.assign(mocks.row, patch); return { data: { id: mocks.row.id }, error: null };
      } }) }),
      then: (resolve: (value: { error: null }) => unknown) => { if (value === mocks.row.id) Object.assign(mocks.row, patch); return Promise.resolve(resolve({ error: null })); },
    }) }) };
  return { from: () => query } as never;
}
const payment = (changes: Record<string, unknown> = {}) => ({ externalReference: 'opaque-ref', externalId: 'mp-1', amount: 1200, currency: 'ARS', status: 'CONFIRMED' as const, ...changes });

beforeEach(() => { vi.clearAllMocks(); Object.assign(mocks.row, { status: 'pending', payment_id: null, firestore_synced: false, last_error: null, expires_at: '2030-01-01T00:00:00.000Z' }); mocks.booking.status = 'pendiente'; });

describe('hub Mercado Pago webhook handling', () => {
  it('confirms a pending unexpired booking in Firestore', async () => {
    await applyHubPayment(payment(), db());
    expect(mocks.row).toMatchObject({ status: 'approved', payment_id: 'mp-1' });
    expect(mocks.updateBooking).toHaveBeenCalledWith({ status: 'confirmada', 'pago.estado': 'aprobado', 'pago.paymentId': 'mp-1' });
  });
  it('rejects amount or currency mismatches without confirming', async () => {
    await applyHubPayment(payment({ amount: 1201 }), db());
    expect(mocks.row.status).toBe('pending');
    expect(mocks.row.last_error).toBe('payment_amount_or_currency_mismatch');
    expect(mocks.updateBooking).not.toHaveBeenCalled();
  });
  it('marks a late approval needs_refund and never confirms the booking', async () => {
    mocks.row.expires_at = '2000-01-01T00:00:00.000Z';
    await applyHubPayment(payment(), db());
    expect(mocks.row.status).toBe('needs_refund');
    expect(mocks.updateBooking).not.toHaveBeenCalled();
  });
  it('rejects canceled payments and does not reopen terminal charges on replay', async () => {
    await applyHubPayment(payment({ status: 'REJECTED' }), db());
    expect(mocks.row.status).toBe('rejected');
    expect(mocks.updateBooking).toHaveBeenCalledWith({ 'pago.estado': 'rechazado', 'pago.paymentId': 'mp-1' });
    mocks.updateBooking.mockClear();
    await applyHubPayment(payment(), db());
    expect(mocks.row.status).toBe('rejected');
    expect(mocks.updateBooking).not.toHaveBeenCalled();
  });
});
