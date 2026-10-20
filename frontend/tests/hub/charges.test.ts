import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  app: { id: 'app-1', slug: 'demo', business_id: 'biz-1', connection_id: 'conn-1', allowed_origins: ['https://shop.test'], firebase_project_id: 'project-1', firebase_sa_encrypted: 'sealed', admin_emails: [], deposit_default: 5000 },
  connection: { provider: 'mercadopago', status: 'active', credentials_encrypted: 'sealed' },
  charge: null as { id: string; preference_id: string | null; init_point?: string | null } | null,
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
vi.mock('@/lib/server/firebaseAdmin', () => ({ firebaseForClientApp: () => ({ auth: { verifyIdToken: mocks.verify }, firestore: { collection: (name: string) => name === 'config' ? { doc: () => ({ get: async () => ({ data: () => ({ senia: mocks.configSenia }) }) }) } : { doc: () => ({ get: mocks.getBooking }) }, runTransaction: async (callback: (transaction: { get: typeof mocks.getBooking; update: typeof mocks.updateBooking }) => unknown) => callback({ get: mocks.getBooking, update: vi.fn((...args: unknown[]) => { mocks.transactionUpdateCount += 1; return mocks.updateBooking(...args); }) }) } }) }));
vi.mock('@/lib/server/hubCharges', () => ({ claimCharge: mocks.create, updateCreatingCharge: mocks.updateCharge, deleteCreatingCharge: mocks.deleteCharge, findCharge: mocks.find }));
vi.mock('@/lib/server/session', () => ({ getServiceClient: mocks.getService }));
vi.mock('@/lib/payments/secretBox', () => ({ decryptSecret: mocks.decrypt }));
vi.mock('node:crypto', () => ({ randomUUID: () => 'opaque-ref' }));

import { POST } from '@/app/api/v1/charges/route';
const request = (data: unknown, origin = 'https://shop.test') => new NextRequest('https://api.test/api/v1/charges', { method: 'POST', headers: { origin, authorization: 'Bearer good', 'content-type': 'application/json' }, body: JSON.stringify(data) });

describe('POST /api/v1/charges', () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.charge = null; mocks.booking = { uid: 'user-1', status: 'pendiente' }; mocks.configSenia = 5000; mocks.owner = 'user-1'; mocks.tokenValid = true; mocks.connectionData = mocks.connection; mocks.connectionError = null; mocks.transactionUpdateCount = 0;
    mocks.load.mockResolvedValue(mocks.app); mocks.allowed.mockImplementation((_app, origin) => origin === 'https://shop.test');
    mocks.verify.mockImplementation(async () => { if (!mocks.tokenValid) throw new Error('bad token'); return { uid: mocks.owner }; });
    mocks.getBooking.mockImplementation(async () => ({ exists: true, data: () => mocks.booking }));
    mocks.find.mockImplementation(async () => mocks.charge); mocks.create.mockImplementation(async (input) => ({ created: true, charge: { id: 'charge-1', ...input, preference_id: null, init_point: null, status: 'creating' } })); mocks.updateCharge.mockResolvedValue({});
    mocks.getService.mockReturnValue({ from: (table: string) => table === 'hub_charges' ? { delete: () => ({ eq: (field: string, value: string) => ({ eq: async (statusField: string, status: string) => { mocks.deleteCharge(value); return { error: null }; } }) }) } : { select: () => ({ eq: (field: string, value: unknown) => field === 'id' ? { eq: (_field: string, _businessId: unknown) => ({ maybeSingle: async () => ({ data: mocks.connectionData, error: mocks.connectionError }) }) } : { is: async () => ({ data: mocks.connectionData, error: mocks.connectionError }) } }) } }); mocks.deleteCharge.mockResolvedValue(undefined);
    mocks.decrypt.mockReturnValue(JSON.stringify({ access_token: 'access' })); mocks.updateBooking.mockResolvedValue(undefined);
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'pref-1', init_point: 'https://mp.test/pref' }) }); vi.stubGlobal('fetch', mocks.fetch); process.env.NEXT_PUBLIC_APP_URL = 'https://api.test';
  });
  it('rejects invalid Firebase ID tokens', async () => { mocks.tokenValid = false; expect((await POST(request({ app: 'demo', bookingId: 'b1' }))).status).toBe(401); });
  it('rejects origins outside the app allowlist', async () => { expect((await POST(request({ app: 'demo', bookingId: 'b1' }, 'https://evil.test'))).status).toBe(403); expect(mocks.verify).not.toHaveBeenCalled(); });
  it('rejects bookings owned by another Firebase uid', async () => { mocks.owner = 'other'; expect((await POST(request({ app: 'demo', bookingId: 'b1' }))).status).toBe(403); });
  it('sends the exact peso amount and checkout payload', async () => {
    const response = await POST(request({ app: 'demo', bookingId: 'b1', amount: 1 }));
    expect(response.status).toBe(200);
    const [, init] = mocks.fetch.mock.calls[0];
    const payload = JSON.parse(init.body);
    expect(init.headers.Authorization).toBe('Bearer access');
    expect(payload.items[0].unit_price).toBe(5000);
    expect(payload.external_reference).toBe('opaque-ref');
    expect(payload.notification_url).toBe('https://api.test/api/webhooks/mercadopago');
    expect(payload.back_urls).toEqual({ success: 'https://shop.test/?pago=exito', failure: 'https://shop.test/?pago=error', pending: 'https://shop.test/?pago=pendiente' });
    expect(Date.parse(payload.date_of_expiration) - Date.now()).toBeGreaterThan(14 * 60_000);
    expect(Date.parse(payload.date_of_expiration) - Date.now()).toBeLessThanOrEqual(15 * 60_000);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 5000, booking_id: 'b1', client_app_id: 'app-1' }));
    expect(mocks.updateCharge).toHaveBeenCalledWith('charge-1', { preference_id: 'pref-1', init_point: 'https://mp.test/pref' });
  });
  it('returns a clear 409 without claiming when connection_id is null', async () => { mocks.load.mockResolvedValue({ ...mocks.app, connection_id: null }); const response = await POST(request({ app: 'demo', bookingId: 'b1' })); expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: 'connection_unavailable', message: 'La dueña todavía no conectó Mercado Pago' }); expect(mocks.create).not.toHaveBeenCalled(); });
  it('returns a clear 409 without claiming when the connection is missing', async () => { mocks.connectionData = null; const response = await POST(request({ app: 'demo', bookingId: 'b1' })); expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: 'connection_unavailable', message: 'La dueña todavía no conectó Mercado Pago' }); expect(mocks.create).not.toHaveBeenCalled(); });
  it('returns a clear 409 without claiming when the connection is inactive', async () => { mocks.connectionData = { ...mocks.connection, status: 'pending' }; const response = await POST(request({ app: 'demo', bookingId: 'b1' })); expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: 'connection_unavailable', message: 'La dueña todavía no conectó Mercado Pago' }); expect(mocks.create).not.toHaveBeenCalled(); });
  it('deletes the claim when the booking is no longer pending', async () => { mocks.booking = { uid: 'user-1', status: 'confirmado' }; const response = await POST(request({ app: 'demo', bookingId: 'b1' })); expect(response.status).toBe(409); expect(mocks.deleteCharge).toHaveBeenCalledWith('charge-1'); expect(mocks.transactionUpdateCount).toBe(0); });
  it('deletes the claim and rolls back the creating booking payment when Mercado Pago fails', async () => { mocks.fetch.mockResolvedValue({ ok: false, status: 502 }); const response = await POST(request({ app: 'demo', bookingId: 'b1' })); expect(response.status).toBe(500); expect(mocks.deleteCharge).toHaveBeenCalledWith('charge-1'); expect(mocks.transactionUpdateCount).toBe(1); });
  it('returns the saved init point when the charge already exists', async () => { mocks.create.mockResolvedValue({ created: false, charge: { id: 'existing', init_point: 'https://mp.test/old' } }); const response = await POST(request({ app: 'demo', bookingId: 'b1' })); expect(await response.json()).toEqual({ init_point: 'https://mp.test/old' }); expect(mocks.fetch).not.toHaveBeenCalled(); });
});
