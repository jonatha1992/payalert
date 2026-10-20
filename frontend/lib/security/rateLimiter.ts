export type RateLimitResult = { allowed: boolean; remaining: number; retryAfter: number };
export interface RateLimiter { check(key: string): Promise<RateLimitResult> }
export interface RateLimitConfig { maxRequests: number; windowMs: number }
type RpcRow = { allowed: boolean; remaining: number; retry_after: number };
type RateLimitRpc = (key: string, windowSeconds: number, limit: number) => Promise<{ data: unknown; error: unknown }>;

export class MemoryRateLimiter implements RateLimiter {
  private readonly requests = new Map<string, { count: number; windowStart: number }>();
  constructor(private readonly config: RateLimitConfig, private readonly now: () => number = Date.now) {
    if (!Number.isInteger(config.maxRequests) || config.maxRequests < 1 || !Number.isInteger(config.windowMs) || config.windowMs < 1) throw new RangeError('Rate limit must use positive integer limits and windows');
  }
  async check(key: string): Promise<RateLimitResult> {
    const now = this.now(), windowStart = Math.floor(now / this.config.windowMs) * this.config.windowMs;
    const entry = this.requests.get(key), current = entry?.windowStart === windowStart ? entry : { count: 0, windowStart };
    current.count += 1; this.requests.set(key, current);
    if (this.requests.size > 10_000) for (const [storedKey, stored] of this.requests) if (stored.windowStart !== windowStart) this.requests.delete(storedKey);
    return { allowed: current.count <= this.config.maxRequests, remaining: Math.max(0, this.config.maxRequests - current.count), retryAfter: Math.max(1, Math.ceil((windowStart + this.config.windowMs - now) / 1000)) };
  }
}

export class SupabaseRateLimiter implements RateLimiter {
  private readonly fallback: MemoryRateLimiter;
  private readonly rpc: RateLimitRpc | null;
  private readonly config: RateLimitConfig;

  constructor(config: RateLimitConfig, rpc: RateLimitRpc | null,
    private readonly log: (event: string) => void = (event) => console.error(JSON.stringify({ event })), now: () => number = Date.now) {
    this.fallback = new MemoryRateLimiter(config, now);
    this.rpc = rpc;
    this.config = config;
  }
  async check(key: string): Promise<RateLimitResult> {
    if (!this.rpc) { this.log('rate_limit_memory_fallback'); return this.fallback.check(key); }
    try {
      const { data, error } = await this.rpc(key, Math.ceil(this.config.windowMs / 1000), this.config.maxRequests);
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as Partial<RpcRow> | null;
      if (!row || typeof row.allowed !== 'boolean' || !Number.isFinite(Number(row.remaining)) || !Number.isFinite(Number(row.retry_after))) throw new Error('invalid_rate_limit_rpc_result');
      return { allowed: row.allowed, remaining: Math.max(0, Number(row.remaining)), retryAfter: Math.max(1, Number(row.retry_after)) };
    } catch { this.log('rate_limit_rpc_fallback'); return this.fallback.check(key); }
  }
}

function createDistributedLimiter(config: RateLimitConfig): RateLimiter {
  let rpc: RateLimitRpc | null = null;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
      const client = createClient(url, key, { auth: { persistSession: false } });
      rpc = async (rateKey, windowSeconds, limit) => client.rpc('rate_limit_hit', { p_key: rateKey, p_window_seconds: windowSeconds, p_limit: limit });
    }
  } catch { console.error(JSON.stringify({ event: 'rate_limit_client_unavailable' })); }
  return new SupabaseRateLimiter(config, rpc);
}

export const webhookRateLimiter = createDistributedLimiter({ maxRequests: 100, windowMs: 60_000 });
export const apiRateLimiter = createDistributedLimiter({ maxRequests: 1000, windowMs: 3_600_000 });
export const authRateLimiter = createDistributedLimiter({ maxRequests: 5, windowMs: 60_000 });
export default MemoryRateLimiter;
