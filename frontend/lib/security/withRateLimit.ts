import { NextRequest, NextResponse } from 'next/server';
import type { RateLimiter } from './rateLimiter';

interface RateLimitOptions { limiter: RateLimiter; key?: (request: NextRequest) => string; getIdentifier?: (request: NextRequest) => string }
type RateLimitedResponse = NextResponse | Response;

export function withRateLimit<C = unknown>(
  handler: (req: NextRequest, context: C) => Promise<RateLimitedResponse>,
  options: RateLimitOptions,
): (req: NextRequest, context: C) => Promise<RateLimitedResponse> {
  return async (req: NextRequest, context: C): Promise<RateLimitedResponse> => {
    const identifier = options.getIdentifier?.(req) ?? getClientIP(req);
    const result = await options.limiter.check(options.key?.(req) ?? `api:${new URL(req.url).pathname}:${identifier}`);
    if (!result.allowed) {
      const retryAfter = Math.max(1, Math.ceil(result.retryAfter));
      return NextResponse.json({ error: 'rate_limit_exceeded', retryAfter }, { status: 429, headers: {
        'Retry-After': String(retryAfter), 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + retryAfter),
      } });
    }
    const response = await handler(req, context);
    response.headers.set('X-RateLimit-Remaining', String(result.remaining));
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000) + result.retryAfter));
    return response;
  };
}

export function withRateLimitForIdentifier(handler: (req: NextRequest, context?: unknown) => Promise<NextResponse>, options: Omit<RateLimitOptions, 'key'> & { namespace: string; getIdentifier?: (req: NextRequest) => string }) {
  return withRateLimit(handler, { limiter: options.limiter, key: (req) => `${options.namespace}:${options.getIdentifier?.(req) ?? getClientIP(req)}` });
}

export function getClientIP(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}
