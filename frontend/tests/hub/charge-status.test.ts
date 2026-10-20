import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ authenticate: vi.fn(), findCharge: vi.fn() }));
vi.mock('@/lib/server/hubAuth', () => ({ authenticateClientApp: mocks.authenticate }));
vi.mock('@/lib/server/hubCharges', () => ({ findCharge: mocks.findCharge }));

import { GET } from '../../app/api/v1/charges/[id]/route';

const app = { id: 'app-1', business_id: 'biz-1', connection_id: 'conn-1', allowed_origins: ['https://shop.test'] };
const charge = { id: 'charge-1', client_app_id: 'app-1', booking_id: 'booking-1', status: 'approved', amount: 5000, expires_at: '2030-01-01T00:15:00.000Z', payment_id: 'payment-1' };
const request = () => new NextRequest('https://api.test/api/v1/charges/booking-1', { headers: { origin: 'https://shop.test', authorization: 'Bearer key' } });
const params = Promise.resolve({ id: 'booking-1' });

describe('GET /api/v1/charges/[id] status', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.authenticate.mockResolvedValue({ app, response: null });
    mocks.findCharge.mockResolvedValue(charge);
  });

  it('returns the requested booking charge status for the authenticated app', async () => {
    const response = await GET(request(), { params });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'approved', amount: 5000, expiresAt: charge.expires_at, paymentId: 'payment-1' });
    expect(mocks.findCharge).toHaveBeenCalledWith('app-1', 'booking-1');
  });

  it('returns 404 when the booking has no charge for the authenticated app', async () => {
    mocks.findCharge.mockResolvedValue(null);
    const response = await GET(request(), { params });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });
  });

  it('does not reveal a charge belonging to another app', async () => {
    mocks.findCharge.mockResolvedValue(null);
    mocks.authenticate.mockResolvedValue({ app: { ...app, id: 'app-2' }, response: null });
    const response = await GET(request(), { params });
    expect(response.status).toBe(404);
    expect(mocks.findCharge).toHaveBeenCalledWith('app-2', 'booking-1');
  });

  it('returns the authentication response without querying charges', async () => {
    const denied = Response.json({ error: 'unauthorized' }, { status: 401 });
    mocks.authenticate.mockResolvedValue({ app: null, response: denied });
    const response = await GET(request(), { params });
    expect(response.status).toBe(401);
    expect(mocks.findCharge).not.toHaveBeenCalled();
  });

  it('omits paymentId when there is no payment yet', async () => {
    mocks.findCharge.mockResolvedValue({ ...charge, status: 'pending', payment_id: null });
    const response = await GET(request(), { params });
    expect(await response.json()).toEqual({ status: 'pending', amount: 5000, expiresAt: charge.expires_at });
  });
});
