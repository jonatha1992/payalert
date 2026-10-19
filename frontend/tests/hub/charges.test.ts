import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  app: { id: 'app-1', slug: 'demo', business_id: 'biz-1', connection_id: 'conn-1', allowed_origins: ['https://shop.test'], firebase_project_id: 'project-1', firebase_sa_encrypted: 'sealed', admin_emails: [], deposit_default: 5000 },
  charge: null as { id: string; preference_id: string | null } | null,
  booking: { uid: 'user-1', status: 'pendiente', config: { pagos: { senia: 1200 } } },
  owner: 'user-1', tokenValid: true,
  load: vi.fn(), allowed: vi.fn(), verify: vi.fn(), getBooking: vi.fn(), find: vi.fn(), create: vi.fn(),
  getService: vi.fn(), updateBooking: vi.fn(), fetch: vi.fn(), decrypt: vi.fn(),
}));
vi.mock('@/lib/server/clientApps', () => ({ loadClientApp: mocks.load, originAllowed: mocks.allowed }));
vi.mock('@/lib/server/firebaseAdmin', () => ({ firebaseForClientApp: () => ({ auth: { verifyIdToken: mocks.verify }, firestore: { collection: () => ({ doc: () => ({ get: mocks.getBooking, update: mocks.updateBooking }) }) } }) }));
vi.mock('@/lib/server/hubCharges', () => ({ createCharge: mocks.create, findCharge: mocks.find }));
vi.mock('@/lib/server/session', () => ({ getServiceClient: mocks.getService }));
vi.mock('@/lib/payments/secretBox', () => ({ decryptSecret: mocks.decrypt }));
vi.mock('node:crypto', () => ({ randomUUID: () => 'opaque-ref' }));

import { POST } from '@/app/api/v1/charges/route';
const request = (data: unknown, origin = 'https://shop.test') => new NextRequest('https://api.test/api/v1/charges', { method: 'POST', headers: { origin, authorization: 'Bearer good', 'content-type': 'application/json' }, body: JSON.stringify(data) });

describe('POST /api/v1/charges', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.charge = null; mocks.booking = { uid: 'user-1', status: 'pendiente', config: { pagos: { senia: 1200 } } }; mocks.owner = 'user-1'; mocks.tokenValid = true;
    mocks.load.mockResolvedValue(mocks.app); mocks.allowed.mockImplementation((_app, origin) => origin === 'https://shop.test');
    mocks.verify.mockImplementation(async () => { if (!mocks.tokenValid) throw new Error('bad token'); return { uid: mocks.owner }; });
    mocks.getBooking.mockImplementation(async () => ({ exists: true, data: () => mocks.booking }));
    mocks.find.mockImplementation(async () => mocks.charge); mocks.create.mockImplementation(async (input) => ({ id: 'charge-1', ...input }));
    mocks.getService.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: { credentials_encrypted: 'sealed' }, error: null }) }) }) }) }) });
    mocks.decrypt.mockReturnValue(JSON.stringify({ access_token: 'access' })); mocks.updateBooking.mockResolvedValue(undefined);
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'pref-1', init_point: 'https://mp.test/pref' }) }); vi.stubGlobal('fetch', mocks.fetch); process.env.NEXT_PUBLIC_APP_URL = 'https://api.test';
  });
  it('rejects invalid Firebase ID tokens', async () => { mocks.tokenValid = false; expect((await POST(request({ app: 'demo', bookingId: 'b1' }))).status).toBe(401); });
  it('rejects origins outside the app allowlist', async () => { expect((await POST(request({ app: 'demo', bookingId: 'b1' }, 'https://evil.test'))).status).toBe(403); expect(mocks.verify).not.toHaveBeenCalled(); });
  it('rejects bookings owned by another Firebase uid', async () => { mocks.owner = 'other'; expect((await POST(request({ app: 'demo', bookingId: 'b1' }))).status).toBe(403); });
  it('uses configured amount and ignores amount in the request body', async () => { const response = await POST(request({ app: 'demo', bookingId: 'b1', amount: 1 })); expect(response.status).toBe(200); expect(mocks.fetch).toHaveBeenCalledOnce(); const [, init] = mocks.fetch.mock.calls[0]; expect(JSON.parse(init.body).items[0].unit_price).toBe(12); });
  it('returns the existing preference without creating another one', async () => { mocks.charge = { id: 'existing', preference_id: 'https://mp.test/old' }; const response = await POST(request({ app: 'demo', bookingId: 'b1' })); expect(await response.json()).toEqual({ init_point: 'https://mp.test/old' }); expect(mocks.fetch).not.toHaveBeenCalled(); });
});
