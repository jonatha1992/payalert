import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({ deleted: false, profile: null as { userId: string; role: string; businessId: string | null; assignedStoreId: null } | null, app: null as Record<string, unknown> | null, connection: null as { id: string } | null, business: null as { id: string } | null, inserted: null as Record<string, unknown> | null, charges: [] as Record<string, unknown>[], inviteError: null as { code?: string; message?: string } | null, invite: null as Record<string, unknown> | null }));
vi.mock('@/lib/server/session', () => ({ getSessionProfile: async () => state.profile, getServiceClient: () => ({ from: (table: string) => new Query(table) }) }));
vi.mock('@/lib/server/audit', () => ({ recordAuditEvent: async () => undefined }));

class Query {
  filters: Record<string, unknown> = {}; action = 'select'; payload: Record<string, unknown> | null = null; projection = '';
  constructor(private table: string) {}
  select(columns = '') { this.projection = columns; return this; } order() { return this; } in() { return this; } neq() { return this; }
  eq(key: string, value: unknown) { this.filters[key] = value; return this; }
  insert(payload: Record<string, unknown>) { this.action = 'insert'; this.payload = payload; return this; }
  update(payload: Record<string, unknown>) { this.action = 'update'; this.payload = payload; return this; }
  delete() { this.action = 'delete'; if (this.table === 'client_apps') state.deleted = true; return this; }
  async maybeSingle() { return { data: this.result(), error: null }; }
  async single() { return { data: this.result(), error: null }; }
  then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) { if (this.table === 'connect_invites' && this.action !== 'delete') { state.invite = this.payload; return Promise.resolve({ data: null, error: state.inviteError }).then(resolve, reject); } return Promise.resolve({ data: this.result(true), error: null }).then(resolve, reject); }
  project(value: Record<string, unknown> | null) { if (!value || !this.projection || this.projection === '*') return value; const keys = this.projection.split(',').map((column) => column.trim().split('(')[0]); return Object.fromEntries(keys.filter((key) => key in value).map((key) => [key, value[key]])); }
  result(asArray = false): unknown {
    if (this.table === 'businesses') {
      if (this.action === 'insert') { state.business = { id: 'business-id' }; return { ...state.business }; }
      return state.business;
    }
    if (this.table === 'payment_connections') return state.connection;
    if (this.table === 'audit_logs') return null;
    if (this.table === 'hub_charges') return state.charges;
    if (this.table === 'connect_invites') return null;
    if (this.table !== 'client_apps') return [];
    if (this.action === 'insert') { state.inserted = this.payload; state.app = { id: 'app-id', ...this.payload }; return this.project(state.app); }
    if (this.action === 'delete') { state.app = null; return null; }
    if (this.action === 'update') { if (state.app) Object.assign(state.app, this.payload); return this.project(state.app); }
    if (this.filters.id && state.app?.id !== this.filters.id) return null;
    const app = this.project(state.app);
    return asArray ? (app ? [app] : []) : app;
  }
}

import { GET, POST } from '@/app/api/admin/client-apps/route';
import { DELETE, PATCH } from '@/app/api/admin/client-apps/[id]/route';
import { POST as createInvite } from '@/app/api/admin/client-apps/[id]/invite/route';
const biz = '11111111-1111-4111-8111-111111111111';
const conn = '22222222-2222-4222-8222-222222222222';
const admin = { userId: 'admin-1', role: 'admin', businessId: null, assignedStoreId: null };
function request(method: string, body?: unknown) { return new NextRequest('https://payalert.test/api/admin/client-apps', { method, headers: { 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
const valid = { name: 'Clínica Huellitas' };

describe('admin client apps API', () => {
  beforeEach(() => { state.profile = admin; state.app = null; state.business = null; state.inserted = null; state.connection = { id: conn }; state.charges = []; });
  it('denies non-admin callers with 403', async () => { state.profile = { ...admin, role: 'owner' }; expect((await GET(request('GET'))).status).toBe(403); });
  it('never returns the stored API-key hash from list responses', async () => { state.app = { id: 'app-id', slug: 'app', business_id: biz, connection_id: conn, allowed_origins: [], deposit_default: 500, item_title: 'Test', active: true, api_key_hash: 'sensitive' }; const response = await GET(request('GET')); expect(await response.text()).not.toContain('api_key_hash'); });
  it('creates an app using only its name and a generated technical business', async () => { const response = await POST(request('POST', valid)); const body = await response.json(); expect(response.status).toBe(201); expect(body.app.slug).toBe('clinica-huellitas'); expect(state.business).toEqual({ id: 'business-id' }); expect(state.inserted).toMatchObject({ slug: 'clinica-huellitas', business_id: 'business-id', connection_id: null, allowed_origins: [], deposit_default: 5000, item_title: 'Seña' }); expect(body.api_key).toMatch(/^pa_clinica-huellitas_/); });
  it('rejects a slug over the limit', async () => { expect((await POST(request('POST', { name: 'a'.repeat(51) }))).status).toBe(400); expect(state.inserted).toBeNull(); });
  it.each(['***', '!!!', 'こんにちは'])('rejects a name without a valid slug: %s', async (name) => { expect((await POST(request('POST', { name }))).status).toBe(400); expect(state.inserted).toBeNull(); });
  it('stores only SHA-256 of the one-time returned key', async () => { const response = await POST(request('POST', valid)); const responseText = await response.text(); const body = JSON.parse(responseText) as { api_key: string }; expect(response.status).toBe(201); expect(state.inserted?.api_key_hash).toBe(createHash('sha256').update(body.api_key).digest('hex')); expect(responseText).not.toContain('api_key_hash'); });
  it('rejects a connection from another business', async () => { state.connection = null; expect((await POST(request('POST', { ...valid, connection_id: conn }))).status).toBe(400); });
  it('rejects invalid origins', async () => { expect((await POST(request('POST', { ...valid, allowed_origins: ['https://*.example'] }))).status).toBe(400); });
  it('allows clearing allowed origins while editing', async () => { state.app = { id: 'app-id', slug: 'client-app', business_id: biz, allowed_origins: ['https://old.test'], deposit_default: 5000, item_title: 'Seña', active: true }; const response = await PATCH(request('PATCH', { allowed_origins: [] }), { params: Promise.resolve({ id: 'app-id' }) }); expect(response.status).toBe(200); expect(state.app.allowed_origins).toEqual([]); });
  it('rotates the key hash and returns the fresh key once', async () => { state.app = { id: 'app-id', slug: 'client-app', business_id: biz, api_key_hash: 'old-hash' }; const response = await PATCH(request('PATCH', { action: 'rotateKey' }), { params: Promise.resolve({ id: 'app-id' }) }); const body = await response.json(); expect(state.app.api_key_hash).toBe(createHash('sha256').update(body.api_key).digest('hex')); expect(state.app.api_key_hash).not.toBe('old-hash'); });
  it('requires admin for invitations and reports missing migrations', async () => { const req = () => new NextRequest('https://payalert.test/api/admin/client-apps/app-id/invite', { method: 'POST' }); state.profile = null; expect((await createInvite(req(), { params: Promise.resolve({ id: 'app-id' }) })).status).toBe(401); state.profile = { ...admin, role: 'owner' }; expect((await createInvite(req(), { params: Promise.resolve({ id: 'app-id' }) })).status).toBe(403); state.profile = admin; state.app = { id: 'app-id', slug: 'app', active: true, connection_id: null }; state.inviteError = { code: '42P01' }; const response = await createInvite(req(), { params: Promise.resolve({ id: 'app-id' }) }); expect(response.status).toBe(503); expect((await response.json()).error).toContain('migraciones 021_connect_invites/022'); });
  it('creates a one-time invitation with only a hash stored', async () => { const req = () => new NextRequest('https://payalert.test/api/admin/client-apps/app-id/invite', { method: 'POST' }); state.profile = admin; state.app = { id: 'app-id', slug: 'app', active: true, connection_id: null }; state.inviteError = null; const response = await createInvite(req(), { params: Promise.resolve({ id: 'app-id' }) }); const body = await response.json(); expect(response.status).toBe(200); if (!/^https:\/\//i.test(body.url)) throw new Error('Invalid invite URL'); expect(new URL(body.url).pathname).toMatch(/^\/connect\/ci_/); expect(state.invite?.client_app_id).toBe('app-id'); expect(state.invite?.token_hash).toHaveLength(64); expect(state.invite).not.toHaveProperty('token'); });
  it('deletes or archives linked apps', async () => { const ctx = { params: Promise.resolve({ id: 'app-id' }) }; const del = () => new NextRequest('https://payalert.test/api/admin/client-apps/app-id', { method: 'DELETE' }); state.profile = { ...admin, role: 'owner' }; expect((await DELETE(del(), ctx)).status).toBe(403); state.profile = admin; state.app = null; expect((await DELETE(del(), { params: Promise.resolve({ id: 'app-id' }) })).status).toBe(404); state.app = { id: 'app-id', slug: 'app', active: true, business_id: biz }; state.charges = [{ id: 'c1' }]; let response = await DELETE(del(), { params: Promise.resolve({ id: 'app-id' }) }); expect(await response.json()).toEqual({ archived: true }); expect(state.app?.active).toBe(false); state.charges = []; state.deleted = false; response = await DELETE(del(), { params: Promise.resolve({ id: 'app-id' }) }); expect(await response.json()).toEqual({ deleted: true }); expect(state.deleted).toBe(true); });
});
