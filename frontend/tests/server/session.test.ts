import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookieUser: vi.fn(),
  bearerUser: vi.fn(),
  maybeSingle: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  createClient: vi.fn(),
  createServerClient: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.createServerClient }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
import { getSessionProfile } from '@/lib/server/session';

const row = { id: 'u1', role: 'owner', business_id: 'biz1', assigned_store_id: null };

function makeRequest(authorization?: string) {
  return new NextRequest('https://example.test/api/test', {
    headers: authorization ? { authorization } : undefined,
  });
}

describe('getSessionProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-test';
    mocks.createClient.mockImplementation((_url: string, key: string) =>
      key === process.env.SUPABASE_SERVICE_ROLE_KEY
        ? { from: mocks.from }
        : { auth: { getUser: mocks.bearerUser } },
    );
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.maybeSingle.mockResolvedValue({ data: row });
    mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.cookieUser } });
    mocks.bearerUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mocks.cookieUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
  });

  it('validates bearer JWT and loads the same profile', async () => {
    const profile = await getSessionProfile(makeRequest('Bearer valid.jwt'));
    expect(profile).toEqual({ userId: 'u1', role: 'owner', businessId: 'biz1', assignedStoreId: null });
    expect(mocks.createClient).toHaveBeenCalledWith('https://supabase.test', 'anon-key-test', { auth: { persistSession: false } });
    expect(mocks.bearerUser).toHaveBeenCalledWith('valid.jwt');
    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expect(mocks.eq).toHaveBeenCalledWith('id', 'u1');
  });

  it('rejects invalid bearer without falling back to cookies', async () => {
    mocks.bearerUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid token') });
    await expect(getSessionProfile(makeRequest('Bearer invalid.jwt'))).resolves.toBeNull();
    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('uses the cookie session when Authorization is absent', async () => {
    await expect(getSessionProfile(makeRequest())).resolves.toEqual({
      userId: 'u1', role: 'owner', businessId: 'biz1', assignedStoreId: null,
    });
    expect(mocks.createServerClient).toHaveBeenCalledOnce();
    expect(mocks.cookieUser).toHaveBeenCalledOnce();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('returns null when the authenticated user has no users row', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null });
    await expect(getSessionProfile(makeRequest('Bearer valid.jwt'))).resolves.toBeNull();
  });

  it('rejects an unknown role', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { ...row, role: 'mystery' } });
    await expect(getSessionProfile(makeRequest('Bearer valid.jwt'))).rejects.toThrow();
  });
});
