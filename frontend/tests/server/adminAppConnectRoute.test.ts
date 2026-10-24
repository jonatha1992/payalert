import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ profile: vi.fn(), app: { id: 'app-1', business_id: 'biz-1', active: true, allowed_origins: [] as string[] }, invite: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/server/session', () => ({
  getSessionProfile: mocks.profile,
  getServiceClient: () => ({ from: (table: string) => table === 'client_apps' ? ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.app, error: null }) }) }), update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }) }) : ({ insert: vi.fn() }) }),
  scopeErrorResponse: (error: unknown) => error instanceof Error && 'status' in error ? new Response(JSON.stringify({ error: error.message }), { status: Number(error.status) }) : null,
}));
vi.mock('@/lib/server/connectInvites', () => ({ createConnectInvite: vi.fn(async (_db: unknown, _app: unknown, options: { baseUrl: string }) => `${options.baseUrl}/connect/opaque`), connectReturnUrlForAdmin: (origin: string) => `${origin}/dashboard/apps` }));
import { POST } from '../../app/api/admin/apps/[slug]/connect/route';
import { createConnectInvite } from '../../lib/server/connectInvites';
const context = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe('POST /api/admin/apps/[slug]/connect', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.app = { id: 'app-1', business_id: 'biz-1', active: true, allowed_origins: [] }; });
  it('requires an authenticated owner', async () => { mocks.profile.mockResolvedValue(null); expect((await POST(new NextRequest('https://payalert.test/api/admin/apps/demo/connect', { method: 'POST' }), context('demo'))).status).toBe(401); });
  it('creates a one-hour invite and returns a URL on the request host without logging its token', async () => {
    mocks.profile.mockResolvedValue({ userId: 'u', role: 'owner' });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await POST(new NextRequest('https://payalert.test/api/admin/apps/huellitas/connect', { method: 'POST' }), context('huellitas'));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ url: 'https://payalert.test/connect/opaque' }); expect(createConnectInvite).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'app-1' }), expect.objectContaining({ hours: 1, baseUrl: 'https://payalert.test' })); expect(log).not.toHaveBeenCalled(); log.mockRestore();
  });
  it('returns 404 for missing and inactive apps', async () => {
    mocks.profile.mockResolvedValue({ userId: 'u', role: 'owner' });
    mocks.app = null as never; expect((await POST(new NextRequest('https://payalert.test/api/admin/apps/no/connect', { method: 'POST' }), context('no'))).status).toBe(404);
    mocks.app = { id: 'app-1', business_id: 'biz-1', active: false, allowed_origins: [] }; expect((await POST(new NextRequest('https://payalert.test/api/admin/apps/off/connect', { method: 'POST' }), context('off'))).status).toBe(404);
  });
});
