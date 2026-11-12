import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  app: { id: 'app-1', business_id: 'biz-1', connection_id: 'conn-1', allowed_origins: ['https://shop.test'], deposit_default: 5000 },
  authenticate: vi.fn(), getService: vi.fn(), maybeSingle: vi.fn(),
}));
vi.mock('@/lib/server/hubAuth', () => ({ authenticateClientApp: mocks.authenticate }));
vi.mock('@/lib/server/session', () => ({ getServiceClient: mocks.getService }));

import { GET, OPTIONS } from '@/app/api/v1/status/route';
const request = (origin = 'https://shop.test') => new NextRequest('https://api.test/api/v1/status', { headers: { origin, authorization: 'Bearer good' } });

describe('GET /api/v1/status', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.authenticate.mockImplementation(async (req: Request) => {
      if (req.headers.get('authorization') !== 'Bearer good') return { app: null, response: new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }) };
      if (req.headers.get('origin') !== 'https://shop.test') return { app: null, response: new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 }) };
      return { app: mocks.app, response: null };
    });
    mocks.maybeSingle.mockResolvedValue({ data: { status: 'CONNECTED' }, error: null });
    mocks.getService.mockReturnValue({ from: (table: string) => ({ select: (columns: string) => ({ eq: (field: string, value: string) => ({ eq: (businessField: string, businessId: string) => ({ maybeSingle: mocks.maybeSingle }) }) }) }) });
  });

  it('reports a connected Mercado Pago account without exposing credentials or account ids', async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ connected: true, deposit_default: 5000 });
    expect(mocks.getService).toHaveBeenCalledOnce();
    expect(mocks.maybeSingle).toHaveBeenCalledOnce();
  });
  it('reports false without querying when connection_id is null', async () => {
    mocks.authenticate.mockResolvedValue({ app: { ...mocks.app, connection_id: null }, response: null });
    const response = await GET(request());
    expect(await response.json()).toEqual({ connected: false, deposit_default: 5000 });
    expect(mocks.getService).not.toHaveBeenCalled();
  });
  it('reports false for a disconnected connection', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { status: 'DISCONNECTED' }, error: null });
    const response = await GET(request());
    expect(await response.json()).toEqual({ connected: false, deposit_default: 5000 });
  });
  it('returns 401 without a valid API key', async () => {
    mocks.authenticate.mockResolvedValue({ app: null, response: new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }) });
    expect((await GET(request())).status).toBe(401);
    expect(mocks.getService).not.toHaveBeenCalled();
  });
  it('includes CORS for an allowed origin', async () => {
    const response = await GET(request());
    expect(response.headers.get('access-control-allow-origin')).toBe('https://shop.test');
  });
  it('rejects a disallowed origin', async () => {
    expect((await GET(request('https://evil.test'))).status).toBe(403);
    expect(mocks.getService).not.toHaveBeenCalled();
  });
  it('answers preflight for an authorized origin', async () => {
    const response = await OPTIONS(request());
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://shop.test');
    expect(response.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS');
  });
});
