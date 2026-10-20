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
    vi.resetAllMocks(); mocks.charge = null; mocks.booking = { uid: 'user-1', status: 'pendiente' }; mocks.configSenia = 5000; mocks.owner = 'user-1'; mocks.tokenValid = true; mocks.connectionData = mocks.connection; mocks.connectionError = null; mocks.transactionUpdateCount = 0;
    mocks.load.mockResolvedValue(mocks.app); mocks.allowed.mockImplementation((_app, origin) => origin === 'https://shop.test'); vi.mocked(authenticateClientApp).mockImplementation(async (req: Request) => req.headers.get('origin') === 'https://evil.test' ? ({ app: null, response: new Response(null, { status: 403 }) } as never) : ({ app: mocks.app, response: null } as never));
    mocks.verify.mockImplementation(async () => { if (!mocks.tokenValid) throw new Error('bad token'); return { uid: mocks.owner }; });
    mocks.getBooking.mockImplementation(async () => ({ exists: true, data: () => mocks.booking }));
    mocks.find.mockImplementation(async () => mocks.charge); mocks.create.mockImplementation(async (input) => ({ created: true, charge: { id: 'charge-1', ...input, preference_id: null, init_point: null, status: 'creating' } })); mocks.updateCharge.mockResolvedValue({});
    mocks.getService.mockReturnValue({ from: (table: string) => table === 'hub_charges' ? { delete: () => ({ eq: (field: string, value: string) => ({ eq: async (statusField: string, status: string) => { mocks.deleteCharge(value); return { error: null }; } }) }) } : { select: () => ({ eq: (field: string, value: unknown) => field === 'id' ? { eq: (_field: string, _businessId: unknown) => ({ maybeSingle: async () => ({ data: mocks.connectionData, error: mocks.connectionError }) }) } : { is: async () => ({ data: mocks.connectionData, error: mocks.connectionError }) } }) } }); mocks.deleteCharge.mockResolvedValue(undefined);
    mocks.decrypt.mockReturnValue(JSON.stringify({ access_token: 'access' })); mocks.updateBooking.mockResolvedValue(undefined);
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'pref-1', init_point: 'https://mp.test/pref' }) }); vi.stubGlobal('fetch', mocks.fetch); process.env.NEXT_PUBLIC_APP_URL = 'https://api.test';
  });
  it('uses the configured deposit and ignores a requested amount when overrides are disabled', async () => {
    const response = await POST(request({ amount: 1200 }));
    expect(response.status).toBe(200);
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).items[0].unit_price).toBe(5000);
  });
  it('uses an allowed integer amount and item title when overrides are enabled', async () => {
    mocks.app = { ...mocks.app, allow_amount_override: true, min_amount: 1000, max_amount: 9000 };
    const response = await POST(request({ amount: 3500, itemTitle: 'Matrícula' }));
    expect(response.status).toBe(200);
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).items[0]).toMatchObject({ unit_price: 3500, title: 'Matrícula' });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 3500 }));
  });
  it.each([999, 9001])('rejects an amount outside the configured range (%s)', async (amount) => {
    mocks.app = { ...mocks.app, allow_amount_override: true, min_amount: 1000, max_amount: 9000 };
    const response = await POST(request({ amount }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_amount' });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('rejects non-integer requested amounts', async () => {
    mocks.app = { ...mocks.app, allow_amount_override: true };
    const response = await POST(request({ amount: 1.5 }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_amount' });
  });
  it('rejects HTML in itemTitle', async () => {
    mocks.app = { ...mocks.app, allow_amount_override: true };
    const response = await POST(request({ amount: 1500, itemTitle: '<b>Cuota</b>' }));
    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('returns amount_mismatch for a pending booking with a different requested amount', async () => {
    mocks.app = { ...mocks.app, allow_amount_override: true };
    mocks.create.mockResolvedValue({ created: false, charge: { id: 'existing', amount: 1200, init_point: 'https://mp.test/old', expires_at: '2030-01-01T00:00:00.000Z', status: 'pending' } });
    const response = await POST(request({ amount: 1300 }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'amount_mismatch' });
  });
  it('authenticates the client app by API key without requiring Firebase identity', async () => { const response = await POST(request({ bookingId: 'b1', payerRef: 'p1', returnUrl: 'https://shop.test/booking/1' })); expect(response.status).toBe(200); expect(authenticateClientApp).toHaveBeenCalledOnce(); });
  it('rejects origins outside the app allowlist', async () => { expect((await POST(request({ app: 'demo', bookingId: 'b1' }, 'https://evil.test'))).status).toBe(403); expect(mocks.verify).not.toHaveBeenCalled(); });
  it('does not access Firebase bookings', async () => { expect((await POST(request({ app: 'demo', bookingId: 'b1' }))).status).toBe(200); expect(mocks.getBooking).not.toHaveBeenCalled(); });
  it('sends the exact peso amount and checkout payload', async () => {
    mocks.app = { ...mocks.app, allow_amount_override: true, min_amount: 1, max_amount: 9000 };
    const response = await POST(request({ app: 'demo', bookingId: 'b1', amount: 1 }));
    const [, init] = mocks.fetch.mock.calls[0];
    const payload = JSON.parse(init.body);
    expect(init.headers.Authorization).toBe('Bearer access');
    expect(payload.items[0].unit_price).toBe(5000);
    expect(payload.external_reference).toBe('opaque-ref');
    expect(payload.notification_url).toBe('https://api.test/api/webhooks/mercadopago');
    expect(payload.back_urls).toEqual({ success: 'https://shop.test/booking/1', failure: 'https://shop.test/booking/1', pending: 'https://shop.test/booking/1' });
    expect(Date.parse(payload.date_of_expiration) - Date.now()).toBeGreaterThan(14 * 60_000);
    expect(Date.parse(payload.date_of_expiration) - Date.now()).toBeLessThanOrEqual(15 * 60_000);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 1, booking_id: 'b1', client_app_id: 'app-1' }));
    expect(mocks.updateCharge).toHaveBeenCalledWith('charge-1', { preference_id: 'pref-1', init_point: 'https://mp.test/pref' });
  });
  it('returns a clear 409 without claiming when connection_id is null', async () => { vi.mocked(authenticateClientApp).mockResolvedValue({ app: { ...mocks.app, connection_id: null }, response: null } as never); const response = await POST(request({ app: 'demo', bookingId: 'b1' })); expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: 'connection_unavailable' }); expect(mocks.create).not.toHaveBeenCalled(); });
  it('returns a clear 409 without claiming when the connection is missing', async () => { mocks.connectionData = null; const response = await POST(request({ app: 'demo', bookingId: 'b1' })); expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: 'connection_unavailable' }); expect(mocks.create).not.toHaveBeenCalled(); });
  it('returns a clear 409 without claiming when the connection is inactive', async () => { mocks.connectionData = { ...mocks.connection, status: 'pending' }; const response = await POST(request({ app: 'demo', bookingId: 'b1' })); expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: 'connection_unavailable' }); expect(mocks.create).not.toHaveBeenCalled(); });
  it('does not read Firestore booking state', async () => { const response = await POST(request({ app: 'demo', bookingId: 'b1' })); expect(response.status).toBe(200); expect(mocks.getBooking).not.toHaveBeenCalled(); });
  it('deletes the claim and rolls back the creating booking payment when Mercado Pago fails', async () => { mocks.fetch.mockResolvedValue({ ok: false, status: 502 }); const response = await POST(request({ app: 'demo', bookingId: 'b1' })); expect(response.status).toBe(500); expect(mocks.deleteCharge).toHaveBeenCalledWith('charge-1'); });
  it('returns the saved init point when the charge already exists', async () => { mocks.create.mockResolvedValue({ created: false, charge: { id: 'existing', amount: 5000, init_point: 'https://mp.test/old', expires_at: '2030-01-01T00:00:00.000Z', status: 'pending' } }); const response = await POST(request({ app: 'demo', bookingId: 'b1' })); expect(await response.json()).toMatchObject({ chargeId: 'existing', checkoutUrl: 'https://mp.test/old' }); expect(mocks.fetch).not.toHaveBeenCalled(); });
});
