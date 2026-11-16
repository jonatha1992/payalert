import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ authenticate: vi.fn(), createInvite: vi.fn() }));
vi.mock('@/lib/server/hubAuth', () => ({ authenticateClientApp: mocks.authenticate }));
vi.mock('@/lib/server/connectInvites', () => ({ createConnectInvite: mocks.createInvite }));
import { POST } from '@/app/api/v1/connect-link/route';
const request = (body: unknown = {}) => new NextRequest('https://api.test/api/v1/connect-link', { method: 'POST', headers: { authorization: 'Bearer good', 'content-type': 'application/json' }, body: JSON.stringify(body) });
describe('POST /api/v1/connect-link', () => {
 beforeEach(() => { vi.resetAllMocks(); mocks.authenticate.mockResolvedValue({ app: { id: 'app-1', connection_id: null }, response: null }); mocks.createInvite.mockResolvedValue({ url: 'https://payalert.test/connect/ci_token', expires_at: '2030-01-01T00:00:00.000Z' }); });
 it('returns 401 without a valid API key', async () => { mocks.authenticate.mockResolvedValue({ app: null, response: new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }) }); expect((await POST(request())).status).toBe(401); expect(mocks.createInvite).not.toHaveBeenCalled(); });
 it('returns 409 when the app already has a connection', async () => { mocks.authenticate.mockResolvedValue({ app: { id: 'app-1', connection_id: 'conn-1' }, response: null }); const response = await POST(request()); expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: 'Ya hay una cuenta de Mercado Pago conectada' }); expect(mocks.createInvite).not.toHaveBeenCalled(); });
 it('returns the generated connection URL and expiry', async () => { const response = await POST(request()); expect(response.status).toBe(200); expect(await response.json()).toEqual({ url: 'https://payalert.test/connect/ci_token', expires_at: '2030-01-01T00:00:00.000Z' }); expect(mocks.createInvite).toHaveBeenCalledWith('app-1', expect.any(String)); });
});
