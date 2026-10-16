import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User, SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  NextResponseRedirect: vi.fn((url: URL) => ({ status: 307, headers: { location: url.toString() } })),
  getServiceClient: vi.fn(),
  bootstrapOwner: vi.fn(),
  logStructured: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.createServerClient }));
vi.mock('@/lib/server/bootstrapOwner', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/bootstrapOwner')>('@/lib/server/bootstrapOwner');
  return { ...actual, bootstrapOwner: mocks.bootstrapOwner, getServiceClient: mocks.getServiceClient };
});
vi.mock('../lib/server/session', () => ({ getServiceClient: mocks.getServiceClient }));
vi.mock('../lib/server/structuredLog', () => ({ logStructured: mocks.logStructured }));
vi.mock('next/server', () => ({
  NextResponse: { redirect: mocks.NextResponseRedirect, next: vi.fn(() => ({ cookies: { getAll: vi.fn(() => []), set: vi.fn() } })) },
}));

import { GET } from '../app/auth/callback/route';
import { safeInternalPath } from '@/lib/server/safeRedirect';
import { bootstrapOwner, isEmailAllowedForSignup } from '@/lib/server/bootstrapOwner';

function request(url: string): NextRequest {
  const parsed = new URL(url);
  return Object.assign(new Request(url, { headers: { cookie: 'sb-test=opaque' } }), {
    nextUrl: parsed,
    cookies: { getAll: () => [], get: () => undefined },
  }) as unknown as NextRequest;
}

describe('Google auth callback', () => {
  const exchangeCodeForSession = vi.fn();
  const getUser = vi.fn();
  const signOut = vi.fn();
  const from = vi.fn();
  const serviceFrom = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-public-key';
    delete process.env.ALLOWED_SIGNUP_EMAILS;
    exchangeCodeForSession.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({ data: { user: { id: 'auth-user-id', email: 'owner@example.com', user_metadata: { full_name: 'Owner Name' } } }, error: null });
    signOut.mockResolvedValue({ error: null });
    from.mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'auth-user-id' }, error: null }) });
    serviceFrom.mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'auth-user-id' }, error: null }) });
    mocks.createServerClient.mockReturnValue({ auth: { exchangeCodeForSession, getUser, signOut }, from });
    mocks.getServiceClient.mockReturnValue({ from: serviceFrom });
    mocks.bootstrapOwner.mockResolvedValue({ created: false });
  });

  it('exchanges valid code and routes only to internal next paths', async () => {
    const response = await GET(request('https://payalert.example/auth/callback?code=valid&next=%2Fdashboard%2Fsettings'));
    expect(exchangeCodeForSession).toHaveBeenCalledWith('valid');
    expect(mocks.NextResponseRedirect).toHaveBeenCalledWith(new URL('/dashboard/settings', 'https://payalert.example'));
    expect(response.status).toBe(307);
  });

  it('rejects invalid code without exposing provider errors', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error('private provider detail') });
    await GET(request('https://payalert.example/auth/callback?code=invalid'));
    expect(mocks.NextResponseRedirect).toHaveBeenCalledWith(new URL('/login?error=oauth_callback_failed', 'https://payalert.example'));
    expect(mocks.logStructured).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ message: expect.stringContaining('private provider detail') }));
  });

  it('rejects unsafe redirect paths', () => {
    expect(safeInternalPath('//evil.example')).toBe('/dashboard');
    expect(safeInternalPath('/\\evil.example')).toBe('/dashboard');
    expect(safeInternalPath('/auth/callback')).toBe('/dashboard');
  });

  it.each(['//evil.example', 'https://evil.example', '/\\evil.example', '/auth/callback'])('uses dashboard for unsafe next path %s', async (next) => {
    await GET(request(`https://payalert.example/auth/callback?code=valid&next=${encodeURIComponent(next)}`));
    expect(mocks.NextResponseRedirect).toHaveBeenCalledWith(new URL('/dashboard', 'https://payalert.example'));
  });

  it('bootstraps only when no profile exists', async () => {
    serviceFrom.mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) });
    await GET(request('https://payalert.example/auth/callback?code=valid'));
    expect(mocks.bootstrapOwner).toHaveBeenCalledWith(expect.objectContaining({ from: expect.any(Function) }), expect.objectContaining({ id: 'auth-user-id', email: 'owner@example.com' }));
  });

  it('does not alter an existing profile', async () => {
    await GET(request('https://payalert.example/auth/callback?code=valid'));
    expect(bootstrapOwner).not.toHaveBeenCalled();
  });

  it('ends session and reports unauthorized signup when allowlist rejects email', async () => {
    serviceFrom.mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) });
    mocks.bootstrapOwner.mockRejectedValue(new Error('signup_not_allowed'));
    await GET(request('https://payalert.example/auth/callback?code=valid'));
    expect(signOut).toHaveBeenCalledOnce();
    expect(mocks.NextResponseRedirect).toHaveBeenCalledWith(new URL('/login?error=signup_not_allowed', 'https://payalert.example'));
  });
});

function syncCallbacks() {
  let userFound = false;
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({ data: userFound ? { id: 'auth-user-id', business_id: 'business-id' } : null, error: null })),
    insert: vi.fn(() => {
      const businessId = 'business-id';
      return {
        select: vi.fn().mockReturnThis(),
        single: vi.fn(async () => ({ data: { id: businessId }, error: null })),
      };
    }),
    upsert: vi.fn(async () => { userFound = true; return { error: null }; }),
    delete: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
    single: vi.fn(async () => ({ data: { business_id: 'business-id' }, error: null })),
  };
}

describe('owner bootstrap', () => {
  beforeEach(() => { mocks.bootstrapOwner.mockReset(); });
  it('creates a business and owner profile once across repeated callbacks', async () => {
    const tables = new Map<string, ReturnType<typeof syncCallbacks>>();
    const db = { from: vi.fn((table: string) => {
      if (!tables.has(table)) tables.set(table, syncCallbacks());
      return tables.get(table)!;
    }) } as unknown as SupabaseClient;
    const user = { id: 'auth-user-id', email: 'owner@example.com', user_metadata: { name: 'Shop Owner' } } as unknown as User;
    const actual = await vi.importActual<typeof import('@/lib/server/bootstrapOwner')>('@/lib/server/bootstrapOwner');
    expect(await actual.bootstrapOwner(db, user)).toEqual({ created: true });
    expect(await actual.bootstrapOwner(db, user)).toEqual({ created: false });
    expect(tables.get('businesses')?.insert).toHaveBeenCalledTimes(1);
    expect(tables.get('users')?.upsert).toHaveBeenCalledTimes(1);
  });
});

describe('signup email allowlist', () => {
  it('allows every email when unset or blank', () => {
    expect(isEmailAllowedForSignup('any@example.com', undefined)).toBe(true);
    expect(isEmailAllowedForSignup('any@example.com', ' , ')).toBe(true);
  });
  it('matches case-insensitively after trimming and rejects others', () => {
    expect(isEmailAllowedForSignup('Owner@Example.com', ' other@example.com, owner@example.com ')).toBe(true);
    expect(isEmailAllowedForSignup('no@example.com', 'owner@example.com')).toBe(false);
  });
});
