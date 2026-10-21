import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({
  profile: null as { userId: string; role: string; businessId: string | null; assignedStoreId: string | null } | null,
  users: [] as Record<string, unknown>[], audit: [] as Record<string, unknown>[],
  storeValid: true,
}));
vi.mock('@/lib/server/session', () => ({
  getSessionProfile: async () => state.profile,
  getServiceClient: () => ({ from: (table: string) => new Query(table) }),
  assertStoreInBusiness: async () => { if (!state.storeValid) throw new Error('invalid store'); },
}));
vi.mock('@/lib/server/audit', () => ({ recordAuditEvent: async (_db: unknown, event: Record<string, unknown>) => { state.audit.push(event); } }));

class Query {
  filters: Record<string, unknown> = {}; action = 'select'; payload: Record<string, unknown> | null = null;
  constructor(private table: string) {}
  select(_columns?: string, _options?: unknown) { return this; } order() { return this; } limit() { return this; }
  eq(key: string, value: unknown) { this.filters[key] = value; return this; }
  update(payload: Record<string, unknown>) { this.action = 'update'; this.payload = payload; return this; }
  maybeSingle() { const user = state.users.find(row => row.id === this.filters.id); return Promise.resolve({ data: user ? { ...user } : null, error: null }); }
  single() { const user = state.users.find(row => row.id === this.filters.id); if (this.action === 'update' && user && this.payload) Object.assign(user, this.payload); return Promise.resolve({ data: user ? { ...user } : null, error: null }); }
  then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
    const rows = this.table === 'users' ? state.users : [];
    if (this.action === 'update') { const user = rows.find(row => row.id === this.filters.id); if (user && this.payload) Object.assign(user, this.payload); return Promise.resolve({ data: user ? { ...user } : null, error: null }).then(resolve, reject); }
    return Promise.resolve({ data: rows, error: null, count: rows.filter(user => user.role === 'admin').length }).then(resolve, reject);
  }
}

import { PATCH } from '@/app/api/admin/users/[id]/route';
const biz = '11111111-1111-4111-8111-111111111111';
const store = '22222222-2222-4222-8222-222222222222';
const admin = { userId: 'admin-1', role: 'admin', businessId: null, assignedStoreId: null };
const user = { id: 'target-1', role: 'owner', business_id: biz, assigned_store_id: null };
function request(body: unknown) { return new NextRequest('https://payalert.test/api/admin/users/target-1', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
const valid = { systemRole: 'user', businessRole: 'employee', business_id: biz, assigned_store_id: store };

describe('admin users API', () => {
  beforeEach(() => { state.profile = admin; state.users = [{ ...user }, { id: 'admin-1', role: 'admin' }, { id: 'admin-2', role: 'admin' }]; state.audit = []; state.storeValid = true; });
  it('denies non-admin callers with 403', async () => { state.profile = { ...admin, role: 'owner' }; expect((await PATCH(request(valid), { params: Promise.resolve({ id: user.id }) })).status).toBe(403); });
  it('prevents demoting the last administrator', async () => { state.users = [{ ...user, role: 'admin' }]; const response = await PATCH(request({ systemRole: 'user', businessRole: 'owner', business_id: biz }), { params: Promise.resolve({ id: user.id }) }); expect(response.status).toBe(409); });
  it('prevents changing own role', async () => { const response = await PATCH(new NextRequest('https://payalert.test/api/admin/users/admin-1', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(valid) }), { params: Promise.resolve({ id: 'admin-1' }) }); expect(response.status).toBe(409); });
  it('requires an assigned store for employees', async () => { const response = await PATCH(request({ systemRole: 'user', businessRole: 'employee', business_id: biz }), { params: Promise.resolve({ id: user.id }) }); expect(response.status).toBe(400); });
  it('updates role and writes audit containing old and new roles', async () => { const response = await PATCH(request(valid), { params: Promise.resolve({ id: user.id }) }); expect(response.status).toBe(200); expect(state.users[0]).toMatchObject({ role: 'employee', business_id: biz, assigned_store_id: store }); expect(state.audit).toHaveLength(1); expect(state.audit[0].newData).toMatchObject({ previous_role: 'owner', role: 'employee' }); });
});
