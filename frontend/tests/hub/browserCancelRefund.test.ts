import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mock = vi.hoisted(() => ({ app: { id: 'app-1', slug: 'huellitas', business_id: 'biz-1', connection_id: 'conn-1', allowed_origins: ['https://huellitasfelices.web.app'], firebase_project_id: 'project-1', api_key_hash: '', active: true, deposit_default: 5000, connect_return_url: null, item_title: 'Seña' }, booking: { uid: 'uid-1', date: '2030-01-03', time: '12:00', status: 'confirmada' }, charge: { id: 'charge-1', booking_id: 'booking-1', status: 'approved', payment_id: 'payment-1', amount: 5000 }, load: vi.fn(), verify: vi.fn(), find: vi.fn(), transition: vi.fn(), complete: vi.fn(), getService: vi.fn(), fetch: vi.fn() }));
vi.mock('@/lib/server/clientApps', () => ({ loadClientApp: mock.load, originAllowedForAnyApp: vi.fn(async () => true) }));
vi.mock('@/lib/server/firebaseIdToken', () => ({ verifyFirebaseIdToken: mock.verify }));
vi.mock('@/lib/server/hubCharges', () => ({ findCharge: mock.find, transitionCharge: mock.transition }));
vi.mock('@/lib/server/hubRefund', () => ({ completeRefund: mock.complete }));
vi.mock('@/lib/server/session', () => ({ getServiceClient: mock.getService }));
import { OPTIONS, POST } from '@/app/api/v1/browser/charges/[bookingId]/cancel-refund/route';

const origin = 'https://huellitasfelices.web.app';
const ctx = { params: Promise.resolve({ bookingId: 'booking-1' }) };
function request(options: { token?: string; origin?: string; method?: string } = {}) {
  return new NextRequest('https://api.test/api/v1/browser/charges/booking-1/cancel-refund?app=huellitas', { method: options.method ?? 'POST', headers: { ...(options.origin === undefined ? { origin } : { origin: options.origin }), ...(options.token === undefined ? {} : { authorization: `Bearer ${options.token}` }) } });
}
function firestoreResponse(booking = mock.booking) {
  return { ok: true, status: 200, json: async () => ({ fields: Object.fromEntries(Object.entries(booking).map(([key, value]) => [key, { stringValue: value }])) }) };
}

describe('POST /api/v1/browser/charges/[bookingId]/cancel-refund', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    Object.assign(mock.booking, { uid: 'uid-1', date: '2030-01-03', time: '12:00', status: 'confirmada' });
    Object.assign(mock.charge, { status: 'approved', payment_id: 'payment-1' });
    mock.load.mockResolvedValue(mock.app);
    mock.verify.mockResolvedValue({ ok: true, uid: 'uid-1', email: 'client@example.test' });
    mock.find.mockResolvedValue(mock.charge);
    mock.transition.mockResolvedValue({ ...mock.charge, status: 'refunding' });
    mock.complete.mockResolvedValue('approved');
    mock.getService.mockReturnValue({});
    mock.fetch.mockResolvedValue(firestoreResponse());
    vi.stubGlobal('fetch', mock.fetch);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T12:00:00-03:00'));
  });
  it('returns 401 when no Firebase token is sent', async () => {
    const response = await POST(request(), ctx);
    expect(response.status).toBe(401);
    expect(mock.verify).not.toHaveBeenCalled();
  });
  it('returns 403 when origin is not allowed', async () => {
    const response = await POST(request({ token: 'firebase', origin: 'https://evil.test' }), ctx);
    expect(response.status).toBe(403);
    expect(mock.verify).not.toHaveBeenCalled();
  });
  it('returns 403 when the booking belongs to another uid', async () => {
    mock.fetch.mockResolvedValueOnce(firestoreResponse({ ...mock.booking, uid: 'other-user' }));
    expect((await POST(request({ token: 'firebase' }), ctx)).status).toBe(403);
    expect(mock.find).not.toHaveBeenCalled();
  });
  it('returns 409 for an unpaid booking', async () => {
    mock.find.mockResolvedValueOnce({ ...mock.charge, status: 'pending' });
    const response = await POST(request({ token: 'firebase' }), ctx);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'not_paid' });
    expect(mock.complete).not.toHaveBeenCalled();
  });
  it('returns 409 when the appointment is inside 24 hours', async () => {
    mock.booking.date = '2030-01-02';
    mock.booking.time = '11:59';
    const response = await POST(request({ token: 'firebase' }), ctx);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'too_late' });
    expect(mock.transition).not.toHaveBeenCalled();
  });
  it('refunds an approved charge exactly at the 24-hour boundary', async () => {
    mock.booking.date = '2030-01-02';
    mock.booking.time = '12:00';
    const response = await POST(request({ token: 'firebase' }), ctx);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'refunded' });
    expect(mock.complete).toHaveBeenCalledOnce();
  });
  it('returns idempotent success for an already-refunded charge', async () => {
    mock.find.mockResolvedValueOnce({ ...mock.charge, status: 'refunded' });
    const response = await POST(request({ token: 'firebase' }), ctx);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'already_refunded' });
    expect(mock.complete).not.toHaveBeenCalled();
  });
  it('returns 502 when Mercado Pago refund fails', async () => {
    mock.complete.mockResolvedValueOnce('rejected');
    const response = await POST(request({ token: 'firebase' }), ctx);
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'refund_failed' });
  });
  it('answers preflight for Huellitas origin', async () => {
    const response = await OPTIONS(request({ origin }));
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(origin);
  });
});
