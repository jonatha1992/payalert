import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ findApp: vi.fn(), hash: '' }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/session', () => ({ getServiceClient: () => ({ from: () => ({ select: () => ({ eq: (_field: string, hash: string) => { mocks.hash = hash; return { eq: () => ({ maybeSingle: async () => ({ data: await mocks.findApp(), error: null }) }) }; } }) }) }) }));

import { authenticateClientApp } from '../../lib/server/hubAuth';

const validKey = 'client-secret';
const app = { id: 'app-1', business_id: 'biz-1', connection_id: 'conn-1', allowed_origins: ['https://shop.test'], active: true };
const request = (authorization: string | null = `Bearer ${validKey}`, origin: string | null = 'https://shop.test') => {
  const headers = new Headers();
  if (authorization) headers.set('authorization', authorization);
  if (origin) headers.set('origin', origin);
  return new NextRequest('https://api.test/api/v1/charges/booking-1', { headers });
};

describe('authenticateClientApp', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.findApp.mockResolvedValue({ ...app, api_key_hash: createHash('sha256').update(validKey).digest('hex') });
  });

  it('authenticates an active app using the SHA-256 API-key hash', async () => {
    const result = await authenticateClientApp(request());
    expect(result.app).toMatchObject(app);
    expect(result.response).toBeNull();
    expect(mocks.hash).toBe(createHash('sha256').update(validKey).digest('hex'));
  });

  it('rejects an invalid API key with a generic 401', async () => {
    mocks.findApp.mockResolvedValue(null);
    const result = await authenticateClientApp(request('Bearer wrong-key'));
    expect(result.app).toBeNull();
    expect(result.response?.status).toBe(401);
    expect(await result.response?.json()).toEqual({ error: 'unauthorized' });
  });

  it('rejects an inactive app with the same generic 401', async () => {
    mocks.findApp.mockResolvedValue({ ...app, active: false, api_key_hash: createHash('sha256').update(validKey).digest('hex') });
    const result = await authenticateClientApp(request());
    expect(result.app).toBeNull();
    expect(result.response?.status).toBe(401);
    expect(await result.response?.json()).toEqual({ error: 'unauthorized' });
  });

  it('rejects an Origin outside the app allowlist with a generic 403', async () => {
    const result = await authenticateClientApp(request(undefined, 'https://evil.test'));
    expect(result.app).toBeNull();
    expect(result.response?.status).toBe(403);
    expect(await result.response?.json()).toEqual({ error: 'forbidden' });
  });

  it('rejects a missing Authorization header with 401 without querying apps', async () => {
    const result = await authenticateClientApp(request(null));
    expect(result.app).toBeNull();
    expect(result.response?.status).toBe(401);
    expect(mocks.findApp).not.toHaveBeenCalled();
  });
});
