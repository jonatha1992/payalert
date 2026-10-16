import { timingSafeEqual } from 'node:crypto';

export function authorizeCron(provided: string | null, secret: string | undefined): 200 | 401 | 503 {
  if (!secret) return 503;
  if (!provided?.startsWith('Bearer ')) return 401;
  const token = Buffer.from(provided.slice(7));
  const expected = Buffer.from(secret);
  return token.length === expected.length && timingSafeEqual(token, expected) ? 200 : 401;
}
