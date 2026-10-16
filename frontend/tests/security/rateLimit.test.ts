import { NextRequest, NextResponse } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRateLimiter, SupabaseRateLimiter } from '../../lib/security/rateLimiter';
import { withRateLimit } from '../../lib/security/withRateLimit';

const config = { maxRequests: 1, windowMs: 1_000 };

describe('distributed rate limiting', () => {
  afterEach(() => vi.restoreAllMocks());

  it('allows, blocks and opens a fresh fixed window', async () => {
    let now = 1_100;
    const limiter = new MemoryRateLimiter(config, () => now);
    await expect(limiter.check('client')).resolves.toMatchObject({ allowed: true, remaining: 0 });
    await expect(limiter.check('client')).resolves.toMatchObject({ allowed: false, remaining: 0 });
    now = 2_000;
    await expect(limiter.check('client')).resolves.toMatchObject({ allowed: true, remaining: 0 });
  });

  it('falls back in memory on an RPC error and logs no error contents or key', async () => {
    const log = vi.fn();
    const rpc = vi.fn(async () => ({ data: null, error: new Error('secret-token') }));
    const limiter = new SupabaseRateLimiter(config, rpc, log);
    await expect(limiter.check('private-client-key')).resolves.toMatchObject({ allowed: true });
    await expect(limiter.check('private-client-key')).resolves.toMatchObject({ allowed: false });
    expect(log).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith('rate_limit_rpc_fallback');
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret-token');
    expect(JSON.stringify(log.mock.calls)).not.toContain('private-client-key');
  });

  it('returns 429 with Retry-After when blocked', async () => {
    const limiter = { check: vi.fn(async () => ({ allowed: false, remaining: 0, retryAfter: 17 })) };
    const handler = withRateLimit(async () => NextResponse.json({ ok: true }), { limiter, key: () => 'ip-key' });
    const response = await handler(new NextRequest('https://example.test/api'), undefined);
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('17');
  });

  it('preserves the exact dynamic route context type and value', async () => {
    type Context = { params: Promise<{ id: string }> };
    const context: Context = { params: Promise.resolve({ id: 'payment-1' }) };
    const limiter = { check: vi.fn(async () => ({ allowed: true, remaining: 2, retryAfter: 60 })) };
    const handler = withRateLimit<Context>(async (_request, received) => {
      expect(await received.params).toEqual({ id: 'payment-1' });
      return NextResponse.json({ ok: true });
    }, { limiter });
    await handler(new NextRequest('https://example.test/api/expected-payments/payment-1'), context);
  });
});
