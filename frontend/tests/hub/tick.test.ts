import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const state = vi.hoisted(() => ({ query: '', updated: [] as unknown[], deleted: [] as { id: string }[], bookingStatus: 'pendiente' }));
const expiredRows = [{ id: 'charge-1', booking_id: 'booking-1', status: 'pending', expires_at: '2000-01-01T00:00:00Z', client_apps: { id: 'app' } }];
vi.mock('@/lib/server/session', () => ({ getServiceClient: () => ({ from: () => { const query = { select: () => query, eq: (_key: string, value: string) => { state.query = value; return query; }, lt: () => query, limit: async () => ({ data: state.query === 'pending' ? expiredRows : [], error: null }), update: (data: unknown) => ({ eq: async () => { state.updated.push(data); return { error: null }; } }) }; return query; } }) }));
vi.mock('@/lib/server/firebaseAdmin', () => ({ firebaseForClientApp: () => ({ firestore: { batch: () => ({ delete: (ref: { id: string }) => state.deleted.push(ref), commit: async () => undefined }), collection: (name: string) => name === 'bookings' ? { doc: () => ({ get: async () => ({ exists: true, data: () => ({ status: state.bookingStatus }) }), update: async (data: unknown) => { state.updated.push(data); } }) } : { where: () => ({ get: async () => ({ docs: [{ ref: { id: 'owned-slot' }, data: () => ({ bookingId: 'booking-1' }) }, { ref: { id: 'foreign-slot' }, data: () => ({ bookingId: 'booking-2' }) }] }) }) } } }) }));
vi.mock('@/lib/server/hubCharges', () => ({ transitionCharge: vi.fn(async (_id: string, _status: string, patch: unknown) => { state.updated.push(patch); }) }));
import { POST } from '@/app/api/internal/hub-tick/route';
const req = (secret: string) => new NextRequest('https://api.test/api/internal/hub-tick', { method: 'POST', headers: { 'x-hub-cron-secret': secret } });
describe('POST /api/internal/hub-tick', () => {
  beforeEach(() => { vi.clearAllMocks(); state.query = ''; state.updated = []; state.deleted = []; state.bookingStatus = 'pendiente'; process.env.HUB_CRON_SECRET = 'cron-secret'; });
  it('rejects an invalid cron secret without querying charges', async () => { expect((await POST(req('wrong'))).status).toBe(401); expect(state.query).toBe(''); });
  it('expires bookings and deletes only slots belonging to that booking', async () => { const response = await POST(req('cron-secret')); expect(response.status).toBe(200); expect(state.deleted).toEqual([{ id: 'owned-slot' }]); expect(state.updated).toContainEqual({ status: 'expirada', pagoExpiradoEn: expect.any(Date) }); });
});
