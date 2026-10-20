import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ app: { id: 'app-1', slug: 'demo', business_id: 'biz-1', connection_id: 'conn-1', allowed_origins: ['https://shop.test'], api_key_hash: 'hash', active: true, deposit_default: 5000 }, charge: { id: 'charge-1', status: 'approved', amount: 5000, expires_at: '2030-01-01T00:15:00.000Z', payment_id: 'payment-1' }, authenticate: vi.fn(), findCharge: vi.fn(), transition: vi.fn(), completeRefund: vi.fn(), getService: vi.fn(), connectionQuery: vi.fn(), claimCharge: vi.fn(), updateCharge: vi.fn(), decrypt: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/clientApps', () => ({ originAllowedForAnyApp: vi.fn(async (origin: string) => origin === 'https://shop.test') }));
vi.mock('@/lib/server/hubAuth', () => ({ authenticateClientApp: mocks.authenticate }));
vi.mock('@/lib/server/hubCharges', () => ({ findCharge: mocks.findCharge, transitionCharge: mocks.transition, claimCharge: mocks.claimCharge, updateCreatingCharge: mocks.updateCharge }));
vi.mock('@/lib/payments/secretBox', () => ({ decryptSecret: mocks.decrypt }));
vi.mock('node:crypto', () => ({ randomUUID: () => 'opaque-reference' }));
vi.mock('@/lib/server/hubRefund', () => ({ completeRefund: mocks.completeRefund }));
vi.mock('@/lib/server/session', () => ({ getServiceClient: mocks.getService }));

import { OPTIONS as chargesOptions, POST as chargesPost } from '@/app/api/v1/charges/route';
import { GET } from '@/app/api/v1/charges/[id]/route';
import { OPTIONS as refundOptions, POST as refundPost } from '@/app/api/v1/charges/[id]/refund/route';

const request = (origin: string, method = 'GET', body?: unknown, preflight = false) => new NextRequest('https://api.test/api/v1/charges/booking-1', { method, headers: { origin, authorization: 'Bearer key', ...(preflight ? { 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type' } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const params = Promise.resolve({ id: 'booking-1' });

describe('hub route CORS', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.authenticate.mockImplementation(async (req: Request) => req.headers.get('origin') === 'https://shop.test' ? ({ app: mocks.app, response: null }) : ({ app: null, response: Response.json({ error: 'forbidden' }, { status: 403 }) }));
    mocks.findCharge.mockResolvedValue(mocks.charge);
    mocks.transition.mockResolvedValue({ id: 'charge-1' });
    mocks.completeRefund.mockResolvedValue('approved');
    mocks.claimCharge.mockResolvedValue({ created: true, charge: { id: 'created-1' } });
    mocks.updateCharge.mockResolvedValue(undefined);
    mocks.decrypt.mockReturnValue(JSON.stringify({ access_token: 'token' }));
    mocks.getService.mockReturnValue({ from: () => ({ select: () => ({ eq: (field: string) => { if (field === 'id') return { eq: () => ({ maybeSingle: async () => ({ data: { provider: 'mercadopago', status: 'active', credentials_encrypted: 'sealed' }, error: null }) }) }; return { is: async () => ({ data: null, error: null }) }; } }) }) });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ id: 'preference-1', init_point: 'https://mp.test/checkout' }) })));
    process.env.NEXT_PUBLIC_APP_URL = 'https://api.test';
  });

  it('adds an allow-origin response header to authorized charge creation', async () => {
    const response = await chargesPost(request('https://shop.test', 'POST', { bookingId: 'booking-1', payerRef: 'opaque', returnUrl: 'https://shop.test/return' }));
    expect(response.headers.get('access-control-allow-origin')).toBe('https://shop.test');
  });

  it('does not add CORS headers to disallowed charge creation', async () => {
    const response = await chargesPost(request('https://evil.test', 'POST', { bookingId: 'booking-1', payerRef: 'opaque', returnUrl: 'https://shop.test/return' }));
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('adds an allow-origin response header for an authorized charge lookup', async () => {
    const response = await GET(request('https://shop.test'), { params });
    expect(response.headers.get('access-control-allow-origin')).toBe('https://shop.test');
  });

  it('does not add CORS headers for a disallowed charge lookup origin', async () => {
    const response = await GET(request('https://evil.test'), { params });
    expect(response.status).toBe(403);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('allows Authorization and Content-Type on a permitted charge preflight', async () => {
    const response = await chargesOptions(request('https://shop.test', 'OPTIONS', undefined, true));
    expect(response.headers.get('access-control-allow-origin')).toBe('https://shop.test');
    expect(response.headers.get('access-control-allow-headers')).toContain('Authorization');
    expect(response.headers.get('access-control-allow-headers')).toContain('Content-Type');
    const denied = await chargesOptions(new NextRequest('https://api.test/api/v1/charges', { method: 'OPTIONS', headers: { origin: 'https://shop.test', 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization, x-custom' } }));
    expect(denied.status).toBe(403);
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('does not expose CORS headers for a disallowed charge preflight', async () => {
    const response = await chargesOptions(request('https://evil.test', 'OPTIONS', undefined, true));
    expect(response.status).toBe(403);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('adds allow-origin on refund responses and refund preflight', async () => {
    const response = await refundPost(request('https://shop.test', 'POST'), { params });
    const preflight = await refundOptions(request('https://shop.test', 'OPTIONS', undefined, true));
    expect(response.headers.get('access-control-allow-origin')).toBe('https://shop.test');
    expect(preflight.headers.get('access-control-allow-origin')).toBe('https://shop.test');
    expect(preflight.headers.get('access-control-allow-headers')).toContain('Authorization');
    expect(preflight.headers.get('access-control-allow-headers')).toContain('Content-Type');
  });

  it('does not expose CORS headers for a disallowed refund response or preflight', async () => {
    const response = await refundPost(request('https://evil.test', 'POST'), { params });
    const preflight = await refundOptions(request('https://evil.test', 'OPTIONS', undefined, true));
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(preflight.headers.get('access-control-allow-origin')).toBeNull();
  });
});
