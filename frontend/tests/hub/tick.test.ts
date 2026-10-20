import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const state = vi.hoisted(() => ({ query: '', updated: [] as unknown[], deleted: [] as { id: string }[], bookingStatus: 'pendiente', transitionResult: true, pages: 0, currentStatus: '', retryRows: false }));
const expiredRows = [{ id: 'charge-1', booking_id: 'booking-1', status: 'pending', expires_at: '2000-01-01T00:00:00Z', client_apps: { id: 'app' } }];
vi.mock('@/lib/server/session', () => ({
  getServiceClient: () => ({ from: () => {
    const queryState = { status: '', synced: '', pending: false };
    const query = {
      select: () => query,
      delete: () => query,
      eq: (key: string, value: unknown) => { if (key === 'status') queryState.status = String(value); if (key === 'firestore_synced') queryState.synced = String(value); return query; },
      lt: (key: string) => { if (queryState.status !== "creating") queryState.pending = true; return query; },
      in: () => query,
      then: (resolve: (value: { data: unknown[]; error: null }) => void) => resolve({ data: [{ id: "stale-claim" }], error: null }),
      order: () => query,
      limit: async () => {
        if (queryState.pending) return { data: state.retryRows || state.transitionResult ? expiredRows : [], error: null };
        state.pages += 1;
        const status = state.currentStatus || 'approved';
        const rows = [{ id: 'charge-' + state.pages, booking_id: 'booking-1', status, client_apps: { id: 'app' } }];
        if (queryState.synced === 'false' && state.pages === 1) return { data: Array.from({ length: state.retryRows ? 100 : 1 }, (_, index) => ({ ...rows[0], id: 'charge-' + index, status: state.currentStatus || 'needs_refund' })), error: null };
        return { data: [], error: null };
      },
      update: (data: unknown) => { state.updated.push(data); const result = { error: null, eq: () => result, then: (resolve: (value: { error: null }) => void) => resolve({ error: null }) }; return result; },
    };
    return query;
  } }) }));
vi.mock('@/lib/server/firebaseAdmin', () => ({ firebaseForClientApp: () => ({ firestore: { runTransaction: async (fn: (transaction: { get: (ref: unknown) => Promise<{ exists: boolean; data: () => { status: string } }>; update: (ref: unknown, data: unknown) => void; delete: (_ref: never) => void }) => Promise<unknown>) => fn({ get: async (ref) => ref && typeof ref === 'object' && 'where' in ref ? ({ docs: [{ ref: { id: 'owned-slot' }, data: () => ({ bookingId: 'booking-1' }) }, { ref: { id: 'foreign-slot' }, data: () => ({ bookingId: 'booking-2' }) }] } as never) : ({ exists: true, data: () => ({ status: state.bookingStatus }) }), update: (_ref, data) => { state.updated.push(data); }, delete: (_ref: never) => { state.deleted.push({ id: 'slot-1' }); } }), collection: (name: string) => name === 'bookings' ? { doc: (id: string) => ({ id, get: async () => ({ exists: true, data: () => ({ status: state.bookingStatus }) }) }) } : { where: () => ({ where: 'slots-query' }) } } }) }));
vi.mock('@/lib/server/hubCharges', () => ({ transitionCharge: vi.fn(async (_id: string, from: string, to: string, patch: unknown) => { state.updated.push(patch); if (state.currentStatus === 'pending') return state.transitionResult ? { id: 'charge-1', status: to } : null; return { id: 'charge-1', status: to }; }) }));
import { POST } from '@/app/api/internal/hub-tick/route';
const req = (secret: string) => new NextRequest('https://api.test/api/internal/hub-tick', { method: 'POST', headers: { 'x-hub-cron-secret': secret } });
describe('POST /api/internal/hub-tick', () => {
  beforeEach(() => { vi.clearAllMocks(); state.query = ''; state.updated = []; state.deleted = []; state.bookingStatus = 'pendiente'; state.transitionResult = true; state.pages = 0; state.currentStatus = ''; state.retryRows = false; process.env.HUB_CRON_SECRET = 'cron-secret'; });
  it('rejects an invalid cron secret without querying charges', async () => { expect((await POST(req('wrong'))).status).toBe(401); expect(state.query).toBe(''); });
  it('claims an expiring row before attempting booking changes', async () => {
    const response = await POST(req('cron-secret'));
    expect(response.status).toBe(200);
    expect(state.updated).toContainEqual({ status: 'expirada', pagoExpiradoEn: expect.any(Date) });
  });
  it('skips booking and slot changes when the claim CAS loses', async () => {
    state.transitionResult = false;
    await POST(req('cron-secret'));
    expect(state.updated).not.toContainEqual({ status: 'expirada', pagoExpiradoEn: expect.any(Date) });
    expect(state.deleted).toEqual([]);
  });
  it('paginates retry rows until no more rows remain', async () => {
    state.currentStatus = 'approved';
    state.retryRows = true;
    await POST(req('cron-secret'));
    expect(state.pages).toBe(2);
  });
  it('marks only needs_refund as synced without editing its booking', async () => {
    state.currentStatus = 'needs_refund';
    state.retryRows = true;
    await POST(req('cron-secret'));
    expect(state.updated).toContainEqual(expect.objectContaining({ firestore_synced: true }));
    expect(state.updated).not.toContainEqual(expect.objectContaining({ status: 'confirmada' }));
  });
});
