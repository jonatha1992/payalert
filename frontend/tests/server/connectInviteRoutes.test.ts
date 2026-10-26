import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { getServiceClient, getSessionProfile, from, exchangeAuthorizationCode, recordAuditEvent } = vi.hoisted(() => ({
  getServiceClient: vi.fn(), getSessionProfile: vi.fn(), from: vi.fn(), exchangeAuthorizationCode: vi.fn(), recordAuditEvent: vi.fn(),
}));
vi.mock('@/lib/security/rateLimiter', () => ({ authRateLimiter: { check: async () => ({ allowed: true, remaining: 100, retryAfter: 0 }) } }));
vi.mock('@/lib/server/session', () => ({ getServiceClient, getSessionProfile, scopeErrorResponse: () => null }));
vi.mock('@/lib/payments/connectors/mercadopagoOAuth', async (orig) => ({ ...(await orig<typeof import('@/lib/payments/connectors/mercadopagoOAuth')>()), exchangeAuthorizationCode }));
vi.mock('@/lib/server/audit', () => ({ recordAuditEvent }));
vi.mock('@/lib/server/rbac', () => ({ can: () => true }));
vi.mock('@/lib/server/scope', () => ({ ScopeError: class extends Error {}, resolveScope: (profile: { businessId: string }, opts: { businessId?: string }) => ({ businessId: opts.businessId ?? profile.businessId }) }));
vi.mock('@/lib/payments/secretBox', () => ({ encryptSecret: (value: string) => `encrypted:${value}` }));

import { GET as connectStart } from '@/app/connect/[token]/route';
import { GET as callback } from '@/app/api/integrations/mercadopago/route';
import { createOAuthState, digestOAuthState } from '@/lib/payments/connectors/mercadopagoOAuth';

const APP = { id: 'app-1', business_id: 'business-1', active: true, connect_return_url: 'https://shop.test/connect/return?source=invite', allowed_origins: ['https://shop.test'], api_key_hash: 'hash', connection_id: null, deposit_default: 100 };
const INVITE = { id: 'invite-1', client_app_id: 'app-1', expires_at: '2099-01-01T00:00:00.000Z', used_at: null, client_apps: APP };
const CONFIG = { clientId: 'client', clientSecret: 'secret', redirectUri: 'https://payalert.test/api/integrations/mercadopago' };
let invite: { id: string; client_app_id: string; expires_at: string; used_at: string | null; client_apps: unknown } | null;
let stateRow: Record<string, unknown> | null;
let updates: Array<{ table: string; values: unknown; filters: Array<[string, unknown]> }>;
let inserts: Array<{ table: string; values: unknown }>;
let accountExists: boolean;

function makeDb() {
  return { from(table: string) {
    const query: any = { table, filters: [], values: null };
    const chain = new Proxy(query, { get(target, key) {
      if (key === 'then') return undefined;
      if (key === 'select' || key === 'update' || key === 'insert') return (value?: unknown) => { if (key === 'update') { target.values = value; updates.push({ table, values: value, filters: target.filters }); } if (key === 'insert') target.values = value; return chain; };
      if (key === 'eq' || key === 'is' || key === 'gt') return (field: string, value: unknown) => { target.filters.push([field, value]); return chain; };
      if (key === 'maybeSingle') return async () => {
        if (table === 'connect_invites' && !target.values) return { data: invite, error: null };
        if (table === 'mp_oauth_states' && !target.values) return { data: stateRow, error: null };
        if (table === 'mp_oauth_states' && target.values) { updates.push({ table, values: target.values, filters: target.filters }); return { data: { state_hash: 'digest' }, error: null }; }
        if (table === 'payment_connections' && !target.values) return { data: accountExists ? { id: 'conn-1' } : null, error: null };
        if (table === 'client_apps' && target.values) { updates.push({ table, values: target.values, filters: target.filters }); return { data: { id: 'app-1' }, error: null }; }
        if (table === 'connect_invites' && target.values) { updates.push({ table, values: target.values, filters: target.filters }); return { data: { id: 'invite-1' }, error: null }; }
        return { data: null, error: null };
      };
      if (key === 'single') return async () => ({ data: { id: 'conn-1' }, error: null });
      if (key === 'select') return () => chain;
      return undefined;
    } });
    return chain;
  } };
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.MP_OAUTH_ENABLED = 'true'; process.env.MP_CLIENT_ID = 'client'; process.env.MP_CLIENT_SECRET = 'secret'; process.env.MP_OAUTH_REDIRECT_URI = CONFIG.redirectUri; process.env.MP_OAUTH_STATE_SECRET = 's'.repeat(40);
  invite = { ...INVITE, client_apps: { ...APP, allowed_origins: [...APP.allowed_origins] } }; stateRow = null; updates = []; inserts = []; accountExists = false;
  getSessionProfile.mockResolvedValue(null); exchangeAuthorizationCode.mockResolvedValue({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, user_id: 42 }); recordAuditEvent.mockResolvedValue(undefined);
  from.mockImplementation(makeDb().from); getServiceClient.mockReturnValue({ from: from });
});

describe('connect invitation start', () => {
  it('sends a valid token to Mercado Pago and inserts a state with null user and invite id', async () => {
    const insert = vi.fn(async (values) => { inserts.push({ table: 'mp_oauth_states', values }); return { error: null }; });
    from.mockImplementation((table: string) => table === 'mp_oauth_states' ? { insert } : makeDb().from(table));
    const response = await connectStart(new NextRequest('https://payalert.test/connect/token'), { params: Promise.resolve({ token: 'token' }) });
    expect(response.status).toBe(307); expect(response.headers.get('location')).toContain('https://auth.mercadopago.com.ar/authorization');
    expect(insert).toHaveBeenCalledOnce(); expect(insert.mock.calls[0][0]).toMatchObject({ business_id: 'business-1', user_id: null, invite_id: 'invite-1' });
  });
  it.each(['expired', 'used', 'missing', 'inactive'] as const)('returns 410 for %s invitations', async (kind) => {
    if (kind === 'expired') invite = { ...INVITE, expires_at: '2000-01-01T00:00:00.000Z' };
    if (kind === 'used') invite = { ...INVITE, used_at: '2025-01-01T00:00:00.000Z' };
    if (kind === 'missing') invite = null;
    if (kind === 'inactive') invite = { ...INVITE, client_apps: { ...APP, active: false } };
    const response = await connectStart(new NextRequest('https://payalert.test/connect/token'), { params: Promise.resolve({ token: 'token' }) });
    expect(response.status).toBe(410); expect(await response.text()).toContain('Este enlace venció o ya se usó');
  });
});

describe('connect invitation callback', () => {
  async function invoke(state = createOAuthState({ tenantId: 'business-1', userId: 'invite:invite-1', nonce: 'nonce', issuedAt: Math.floor(Date.now() / 1000) })) {
    stateRow = { state_hash: digestOAuthState(state), business_id: 'business-1', user_id: null, invite_id: 'invite-1', nonce_hash: 'nonce-hash', expires_at: '2099-01-01T00:00:00.000Z', consumed_at: null };
    const response = await callback(new NextRequest(`https://payalert.test/api/integrations/mercadopago?code=ok&state=${encodeURIComponent(state)}`)); return response;
  }
  it('saves the connection, links only the invited app, consumes invite and redirects to its allowed URL', async () => {
    const response = await invoke();
    expect(response.status).toBe(307); expect(response.headers.get('location')).toBe('https://shop.test/connect/return?source=invite&mp=connected');
    expect(updates.some((item) => item.table === 'client_apps' && (item.values as any).connection_id === 'conn-1' && item.filters.some(([key, value]) => key === 'id' && value === 'app-1'))).toBe(true);
    expect(updates.some((item) => item.table === 'connect_invites' && (item.values as any).used_at)).toBe(true);
    expect(recordAuditEvent).toHaveBeenCalledOnce();
  });
  it('redirects to failed and leaves invitation unused when Mercado Pago code exchange fails', async () => {
    exchangeAuthorizationCode.mockRejectedValueOnce(new Error('exchange failed'));
    const response = await invoke();
    expect(response.headers.get('location')).toContain('mp=failed'); expect(updates.some((item) => item.table === 'connect_invites')).toBe(false); const reopened = await connectStart(new NextRequest('https://payalert.test/connect/token', { headers: { 'x-forwarded-for': '203.0.113.77' } }), { params: Promise.resolve({ token: 'token' }) }); expect(reopened.status).toBe(307);
  });
  it.each(['expired', 'used'] as const)('rejects a %s invitation', async (kind) => {
    if (kind === 'expired') invite = { ...INVITE, expires_at: '2000-01-01T00:00:00.000Z' };
    if (kind === 'used') invite = { ...INVITE, used_at: '2025-01-01T00:00:00.000Z' };
    const response = await invoke(); expect(response.headers.get('location')).toContain('mp=failed');
  });
  it('rejects a state belonging to another invitation', async () => {
    stateRow = { state_hash: 'digest', business_id: 'business-1', user_id: null, invite_id: 'invite-other', consumed_at: null };
    const response = await callback(new NextRequest('https://payalert.test/api/integrations/mercadopago?code=ok&state=x'));
    expect(response.headers.get('location')).toContain('mp=failed');
  });
  it('never redirects to a return URL outside allowed origins', async () => {
    invite = { ...INVITE, client_apps: { ...APP, connect_return_url: 'https://attacker.test/return', allowed_origins: ['https://shop.test'] } };
    const response = await invoke(); expect(response.headers.get('location')).toContain('/dashboard/integrations?oauth=failed');
  });
  it('keeps owner OAuth callback behind the owner session and preserves its dashboard redirect', async () => {
    const ownerState = createOAuthState({ tenantId: 'business-1', userId: 'owner-1', nonce: 'nonce', issuedAt: Math.floor(Date.now() / 1000) });
    stateRow = { state_hash: digestOAuthState(ownerState), business_id: 'business-1', user_id: 'owner-1', invite_id: null, consumed_at: null };
    getSessionProfile.mockResolvedValueOnce({ role: 'owner', userId: 'owner-1', businessId: 'business-1' });
    const response = await callback(new NextRequest(`https://payalert.test/api/integrations/mercadopago?code=ok&state=${encodeURIComponent(ownerState)}`));
    expect(response.headers.get('location')).toContain('/dashboard/integrations?oauth=connected');
  });
});
