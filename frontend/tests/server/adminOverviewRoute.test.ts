import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ profile: vi.fn(), tables: {} as Record<string, Record<string, unknown>[]> }));
vi.mock('@/lib/server/session', () => ({ getSessionProfile: mocks.profile, getServiceClient: () => ({ from: (table: string) => ({ select: (_columns: string, options?: { head?: boolean }) => {
  const rows = mocks.tables[table] ?? [];
  if (options?.head) return { count: rows.length, error: null };
  const query = { gte: () => query, order: () => query, limit: async () => ({ data: rows, error: null }), then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve) };
  return query;
} }) }) }));
import { GET } from '@/app/api/admin/overview/route';

const request = () => new NextRequest('https://example.test/api/admin/overview');
describe('GET /api/admin/overview', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.tables = {}; });
  it('returns 401 without session', async () => { mocks.profile.mockResolvedValue(null); expect((await GET(request())).status).toBe(401); });
  it('returns 403 for non-admin', async () => { mocks.profile.mockResolvedValue({ role: 'owner' }); expect((await GET(request())).status).toBe(403); });
  it('returns aggregate counts and recent activity for admin', async () => {
    mocks.profile.mockResolvedValue({ role: 'admin' });
    mocks.tables = { businesses: [{}, {}], users: [{}], client_apps: [{ connection_id: null }, { connection_id: 'c' }], payment_connections: [{ provider: 'mercado_pago', status: 'CONNECTED' }, { provider: 'uala', status: 'DISCONNECTED' }], hub_charges: [{ status: 'approved' }, { status: 'pending' }], audit_logs: [{ action: 'LOGIN', created_at: '2026-01-01T00:00:00Z', users: { email: 'admin@example.test' } }] };
    const response = await GET(request()); const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ businesses: 2, users: 1, apps: { total: 2, unconnected: 1 }, connections: { total: 2, mercado_pago: { connected: 1 }, uala: { disconnected: 1 } }, activity: [{ actor: 'admin@example.test' }] });
  });
  it('returns a clear zero state when tables are empty', async () => {
    mocks.profile.mockResolvedValue({ role: 'admin' });
    const response = await GET(request()); const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ businesses: 0, users: 0, apps: { total: 0, unconnected: 0 }, connections: { total: 0 }, charges: { today: { approved: 0, pending: 0 }, month: { approved: 0, pending: 0 } }, activity: [] });
  });
});
