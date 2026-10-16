import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ profile: vi.fn(), log: vi.fn(), check: vi.fn(async () => ({ allowed: true, remaining: 20, retryAfter: 60 })), tables: {} as Record<string, any> }));
vi.mock('@/lib/server/session', () => ({ getSessionProfile: mocks.profile, scopeErrorResponse: (e: Error, _request: NextRequest) => e.message === 'unauthorized' ? Response.json({ error: 'Unauthorized' }, { status: 401 }) : null, getServiceClient: () => ({ from: (name: string) => mocks.tables[name] }) }));
vi.mock('@/lib/security/rateLimiter', () => ({ apiRateLimiter: { check: mocks.check } }));
vi.mock('@/lib/server/structuredLog', () => ({ logStructured: mocks.log }));
import { POST, DELETE } from '@/app/api/push/devices/route';

function chain(_table: string) { const q: any = {}; for (const method of ['upsert','update','eq','is']) q[method] = vi.fn(() => q); return q; }
const valid = 'ExponentPushToken[abc123]';
beforeEach(() => { vi.clearAllMocks(); mocks.profile.mockResolvedValue({ userId:'user-1', businessId:'biz-1', role:'owner', assignedStoreId:null }); mocks.tables.device_push_tokens = chain('device_push_tokens'); });
describe('push device routes', () => {
 it('registers a valid token under session scope, not body scope', async () => {
  const res = await POST(new NextRequest('https://example.test/api/push/devices', { method:'POST', body:JSON.stringify({ platform:'ios', expoPushToken:valid, businessId:'attacker', userId:'attacker' }) }), {});
  expect(res.status).toBe(200); expect(mocks.tables.device_push_tokens.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id:'user-1', business_id:'biz-1', expo_push_token:valid }), { onConflict:'expo_push_token' });
  expect(JSON.stringify(mocks.log.mock.calls)).not.toContain(valid);
 });
 it('rejects invalid tokens', async () => { const res = await POST(new NextRequest('https://example.test/api/push/devices', { method:'POST', body:JSON.stringify({ platform:'ios', expoPushToken:'secret-token' }) }), {}); expect(res.status).toBe(400); });
 it('returns 401 without session', async () => { mocks.profile.mockRejectedValue(new Error('unauthorized')); const res = await POST(new NextRequest('https://example.test/api/push/devices', { method:'POST', body:JSON.stringify({ platform:'ios', expoPushToken:valid }) }), {}); expect(res.status).toBe(401); });
 it('revokes only the session user and business token', async () => { const res = await DELETE(new NextRequest('https://example.test/api/push/devices', { method:'DELETE', body:JSON.stringify({ expoPushToken:valid, businessId:'attacker', userId:'attacker' }) }), {}); expect(res.status).toBe(200); const q=mocks.tables.device_push_tokens; expect(q.eq).toHaveBeenCalledWith('user_id','user-1'); expect(q.eq).toHaveBeenCalledWith('business_id','biz-1'); expect(q.is).toHaveBeenCalledWith('revoked_at',null); });
});
