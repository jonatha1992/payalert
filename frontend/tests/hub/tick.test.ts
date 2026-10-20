import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const state = vi.hoisted(() => ({ query: '', updated: [] as unknown[], deleted: [] as { id: string }[], deleteExpected: false, bookingStatus: 'pendiente', transitionResult: true, pages: 0, currentStatus: '', retryRows: false }));
const expiredRows = [{ id: 'charge-1', booking_id: 'booking-1', status: 'pending', expires_at: '2000-01-01T00:00:00Z', client_apps: { id: 'app' } }];
vi.mock('@/lib/server/session', () => ({
  getServiceClient: () => ({ from: () => {
    const queryState = { status: '', synced: '', pending: false, creating: false, data: [] as unknown[] };
    const query = {
      select: () => query,
      delete: () => { queryState.creating = true; return query; },
      eq: (key: string, value: unknown) => { if (key === 'status') queryState.status = String(value); if (key === 'firestore_synced') queryState.synced = String(value); return query; },
      lt: (_key: string, value: string) => { if (queryState.creating) { state.deleted.push({ id: value }); queryState.data = [{ id: "stale" }]; } else queryState.pending = true; return query; },
      in: () => query,
      then: (resolve: (value: { data: unknown[]; error: null }) => void) => resolve({ data: queryState.data, error: null }),
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

vi.mock('@/lib/server/hubCharges', () => ({ transitionCharge: vi.fn(async (_id: string, from: string, to: string, patch: unknown) => { state.updated.push(patch); if (state.currentStatus === 'pending') return state.transitionResult ? { id: 'charge-1', status: to } : null; return { id: 'charge-1', status: to }; }) }));
import { POST } from '@/app/api/internal/hub-tick/route';
const req = (secret: string) => new NextRequest('https://api.test/api/internal/hub-tick', { method: 'POST', headers: { 'x-hub-cron-secret': secret } });
describe('POST /api/internal/hub-tick', () => {
  beforeEach(() => { vi.resetAllMocks(); state.query = ''; state.updated = []; state.deleted = []; state.bookingStatus = 'pendiente'; state.transitionResult = true; state.deleteExpected = false; state.pages = 0; state.currentStatus = ''; state.retryRows = false; process.env.HUB_CRON_SECRET = 'cron-secret'; });
  it('rejects an invalid cron secret without querying charges', async () => { expect((await POST(req('wrong'))).status).toBe(401); expect(state.query).toBe(''); });
  it('expires only the hub charge with a pending-to-expired CAS', async () => {
    const response = await POST(req('cron-secret'));
    expect(response.status).toBe(200);
    expect(state.updated).toContainEqual({ last_error: null });
    expect(state.updated).not.toContainEqual(expect.objectContaining({ status: 'expirada' }));
    expect(state.deleted).toHaveLength(1);
  });
  it('skips booking and slot changes when the claim CAS loses', async () => {
    state.transitionResult = false;
    await POST(req('cron-secret'));
    expect(state.updated).not.toContainEqual({ status: 'expirada', pagoExpiradoEn: expect.any(Date) });
    expect(state.deleted).toHaveLength(1);
  });
  it('does not retry Firestore synchronization rows', async () => { state.currentStatus = 'approved'; state.retryRows = true; const response = await POST(req('cron-secret')); expect(state.pages).toBe(0); expect(await response.json()).not.toHaveProperty('retried'); });
  it('deletes creating claims older than five minutes', async () => {
    const response = await POST(req('cron-secret'));
    expect(response.status).toBe(200);
    expect((await response.json()).staleCreating).toBe(1); expect(Date.now() - Date.parse(state.deleted[0].id)).toBeGreaterThanOrEqual(300_000);
  });

  it('does not mark needs_refund synced or touch Firestore', async () => { state.currentStatus = 'needs_refund'; state.retryRows = true; const response = await POST(req('cron-secret')); expect(state.updated).not.toContainEqual(expect.objectContaining({ firestore_synced: true })); expect(await response.json()).not.toHaveProperty('retried'); });
});
