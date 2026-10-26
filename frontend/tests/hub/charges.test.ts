import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  app: { id: 'app-1', slug: 'demo', business_id: 'biz-1', connection_id: 'conn-1', allowed_origins: ['https://shop.test'], api_key_hash: 'hash', active: true, deposit_default: 5000 },
  connection: { provider: 'mercadopago', status: 'active', credentials_encrypted: 'sealed' },
  charge: null as { id: string; preference_id: string | null; init_point?: string | null; expires_at?: string; status?: string } | null,
  booking: { uid: 'user-1', status: 'pendiente' },
  configSenia: 5000,
  owner: 'user-1', tokenValid: true,
  load: vi.fn(), allowed: vi.fn(), verify: vi.fn(), getBooking: vi.fn(), find: vi.fn(), create: vi.fn(),
  getService: vi.fn(), updateBooking: vi.fn(), updateCharge: vi.fn(), deleteCharge: vi.fn(), fetch: vi.fn(), decrypt: vi.fn(),
  feeData: null as { fee_type: 'fixed' | 'percent'; fee_value: number } | null, feeError: null as Error | null,
  connectionData: null as { provider: string; status: string; credentials_encrypted: string } | null | undefined,
  connectionError: null as Error | null,
  transactionUpdateCount: 0,
}));
vi.mock('@/lib/server/clientApps', () => ({ loadClientApp: mocks.load, originAllowed: mocks.allowed, originAllowedForAnyApp: vi.fn(async () => true) }));
vi.mock('@/lib/server/hubAuth', () => ({ authenticateClientApp: vi.fn(async () => ({ app: mocks.app, response: null })) }));
vi.mock('@/lib/server/hubCharges', () => ({ claimCharge: mocks.create, updateCreatingCharge: mocks.updateCharge, deleteCreatingCharge: mocks.deleteCharge, findCharge: mocks.find }));
vi.mock('@/lib/server/session', () => ({ getServiceClient: mocks.getService }));
vi.mock('@/lib/payments/secretBox', () => ({ decryptSecret: mocks.decrypt }));
vi.mock('node:crypto', () => ({ randomUUID: () => 'opaque-ref' }));

import { POST } from '@/app/api/v1/charges/route';
import { authenticateClientApp } from '@/lib/server/hubAuth';
const request = (data: Record<string, unknown> = {}, origin = 'https://shop.test') => new NextRequest('https://api.test/api/v1/charges', { method: 'POST', headers: { origin, authorization: 'Bearer good', 'content-type': 'application/json' }, body: JSON.stringify({ bookingId: 'b1', payerRef: 'p1', returnUrl: 'https://shop.test/booking/1', ...data }) });

describe('POST /api/v1/charges', () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.charge = null; mocks.booking = { uid: 'user-1', status: 'pendiente' }; mocks.configSenia = 5000; mocks.owner = 'user-1'; mocks.tokenValid = true; mocks.connectionData = mocks.connection; mocks.connectionError = null; mocks.feeData = null; mocks.feeError = null; mocks.transactionUpdateCount = 0;
    mocks.load.mockResolvedValue(mocks.app); mocks.allowed.mockImplementation((_app, origin) => origin === 'https://shop.test'); vi.mocked(authenticateClientApp).mockImplementation(async (req: Request) => req.headers.get('origin') === 'https://evil.test' ? ({ app: null, response: new Response(null, { status: 403 }) } as never) : ({ app: mocks.app, response: null } as never));
    mocks.verify.mockImplementation(async () => { if (!mocks.tokenValid) throw new Error('bad token'); return { uid: mocks.owner }; });
    mocks.getBooking.mockImplementation(async () => ({ exists: true, data: () => mocks.booking }));
    mocks.find.mockImplementation(async () => mocks.charge); mocks.create.mockImplementation(async (input) => ({ created: true, charge: { id: 'charge-1', ...input, preference_id: null, init_point: null, status: 'creating' } })); mocks.updateCharge.mockResolvedValue({});
    mocks.getService.mockReturnValue({ from: (table: string) => table === 'hub_charges' ? { delete: () => ({ eq: (field: string, value: string) => ({ eq: async (statusField: string, status: string) => { mocks.deleteCharge(value); return { error: null }; } }) }) } : { select: (columns: string) => ({ eq: (field: string, value: unknown) => columns === 'fee_type,fee_value' ? { maybeSingle: async () => ({ data: mocks.feeData, error: mocks.feeError }) } : field === 'id' ? { eq: (_field: string, _businessId: unknown) => ({ maybeSingle: async () => ({ data: mocks.connectionData, error: mocks.connectionError }) }) } : { is: async () => ({ data: mocks.connectionData, error: mocks.connectionError }) } }) } }); mocks.deleteCharge.mockResolvedValue(undefined);
    mocks.decrypt.mockReturnValue(JSON.stringify({ access_token: 'access' })); mocks.updateBooking.mockResolvedValue(undefined);
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'pref-1', init_point: 'https://mp.test/pref' }) }); vi.stubGlobal('fetch', mocks.fetch); process.env.NEXT_PUBLIC_APP_URL = 'https://api.test';
  });
  it('authenticates the client app by API key without requiring Firebase identity', async () => { const response = await POST(request({ bookingId: 'b1', payerRef: 'p1', returnUrl: 'https://shop.test/booking/1' })); expect(response.status).toBe(200); expect(authenticateClientApp).toHaveBeenCalledOnce(); });
  it('rejects origins outside the app allowlist', async () => { expect((await POST(request({ app: 'demo', bookingId: 'b1' }, 'https://evil.test'))).status).toBe(403); expect(mocks.verify).not.toHaveBeenCalled(); });
  it('does not access Firebase bookings', async () => { expect((await POST(request({ app: 'demo', bookingId: 'b1', amount: 2500 }))).status).toBe(200); expect(mocks.getBooking).not.toHaveBeenCalled(); });
  it('sends the exact peso amount and checkout payload', async () => {
    const response = await POST(request({ app: 'demo', bookingId: 'b1', amount: 2 }));
    expect(response.status).toBe(200);
    const [, init] = mocks.fetch.mock.calls[0];
    const payload = JSON.parse(init.body);
    expect(init.headers.Authorization).toBe('Bearer access');
    expect(payload.items[0].unit_price).toBe(2);
    expect(payload.marketplace_fee).toBe(1);
    expect(payload.external_reference).toBe('opaque-ref');
    expect(payload.notification_url).toBe('https://api.test/api/webhooks/mercadopago');
    expect(payload.back_urls).toEqual({ success: 'https://shop.test/booking/1', failure: 'https://shop.test/booking/1', pending: 'https://shop.test/booking/1' });
    expect(Date.parse(payload.date_of_expiration) - Date.now()).toBeGreaterThan(14 * 60_000);
    expect(Date.parse(payload.date_of_expiration) - Date.now()).toBeLessThanOrEqual(15 * 60_000);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 2, booking_id: 'b1', client_app_id: 'app-1' }));
    expect(mocks.updateCharge).toHaveBeenCalledWith('charge-1', { preference_id: 'pref-1', init_point: 'https://mp.test/pref' });
  });
  it('accepts an explicit amount of 2500 ARS', async () => { const response = await POST(request({ bookingId: 'b1', amount: 2500 })); expect(response.status).toBe(200); expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 2500 })); const [, init] = mocks.fetch.mock.calls[0]; expect(JSON.parse(init.body).items[0].unit_price).toBe(2500); });
  it.each([0, -1, 1.5, 1_000_001, '100'])('rejects invalid amount %s before accessing the connection', async (amount) => { const response = await POST(request({ bookingId: 'b1', amount })); expect(response.status).toBe(400); expect(await response.json()).toEqual({ error: 'amount_must_be_integer_ars_between_1_and_1000000' }); expect(mocks.getService).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled(); });
  it('rejects an invalid configured default when amount is omitted', async () => { vi.mocked(authenticateClientApp).mockResolvedValue({ app: { ...mocks.app, deposit_default: null }, response: null } as never); const response = await POST(request({ bookingId: 'b1' })); expect(response.status).toBe(400); expect(mocks.create).not.toHaveBeenCalled(); });
  it('returns a clear CORS-enabled 409 without DB, claim or Mercado Pago access when connection_id is null', async () => { vi.mocked(authenticateClientApp).mockResolvedValue({ app: { ...mocks.app, connection_id: null }, response: null } as never); const response = await POST(request({ app: 'demo', bookingId: 'b1' })); expect(response.status).toBe(409); expect(response.headers.get('access-control-allow-origin')).toBe('https://shop.test'); expect(await response.json()).toEqual({ error: 'connection_unavailable' }); expect(mocks.getService).toHaveBeenCalledOnce(); expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled(); });
  it('returns a clear 409 without claiming when the connection is missing', async () => { mocks.connectionData = null; const response = await POST(request({ app: 'demo', bookingId: 'b1' })); expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: 'connection_unavailable' }); expect(mocks.create).not.toHaveBeenCalled(); });
  it('returns a clear 409 without claiming when the connection is inactive', async () => { mocks.connectionData = { ...mocks.connection, status: 'pending' }; const response = await POST(request({ app: 'demo', bookingId: 'b1' })); expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: 'connection_unavailable' }); expect(mocks.create).not.toHaveBeenCalled(); });
  it('does not read Firestore booking state', async () => { const response = await POST(request({ app: 'demo', bookingId: 'b1' })); expect(response.status).toBe(200); expect(mocks.getBooking).not.toHaveBeenCalled(); });
  it('deletes the claim and rolls back the creating booking payment when Mercado Pago fails', async () => { mocks.fetch.mockResolvedValue({ ok: false, status: 502 }); const response = await POST(request({ app: 'demo', bookingId: 'b1' })); expect(response.status).toBe(500); expect(mocks.deleteCharge).toHaveBeenCalledWith('charge-1'); });
  it('returns the saved init point when the charge already exists at the same amount', async () => { mocks.create.mockResolvedValue({ created: false, charge: { id: 'existing', amount: 1000, init_point: 'https://mp.test/old', expires_at: '2030-01-01T00:00:00.000Z', status: 'pending' } }); const response = await POST(request({ app: 'demo', bookingId: 'b1', amount: 1000 })); expect(await response.json()).toMatchObject({ chargeId: 'existing', checkoutUrl: 'https://mp.test/old' }); expect(mocks.fetch).not.toHaveBeenCalled(); });
  it('rejects amount conflict on idempotent booking id reuse', async () => { mocks.create.mockResolvedValue({ created: false, charge: { id: 'existing', amount: 1000, init_point: 'https://mp.test/old', status: 'pending' } }); const response = await POST(request({ app: 'demo', bookingId: 'b1', amount: 2000 })); expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: 'booking_amount_conflict' }); expect(mocks.fetch).not.toHaveBeenCalled(); });
});
