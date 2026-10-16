import { describe, expect, it } from 'vitest';
import { authorizeCron } from '@/lib/server/cronAuth';

describe('cron authorization', () => {
  it('returns unavailable when secret is missing', () => expect(authorizeCron('Bearer token', undefined)).toBe(503));
  it('rejects incorrect tokens and accepts the exact bearer token', () => {
    expect(authorizeCron('Bearer wrong', 'secret')).toBe(401);
    expect(authorizeCron('Bearer secret', 'secret')).toBe(200);
  });
});
