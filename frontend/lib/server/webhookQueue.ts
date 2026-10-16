import type { SupabaseClient } from '@supabase/supabase-js';

export type QueueStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED' | 'DEAD';
export interface WebhookEvent { id: string; provider: string; connection_id: string; dedupe_key: string; payload: unknown }
export interface QueueRow extends WebhookEvent { status: QueueStatus; attempts: number; next_attempt_at: string; locked_at: string | null; created_at: string; last_error_code: string | null }
export interface QueueOptions { now?: () => Date; random?: () => number; maxAttempts?: number; lockTimeoutMs?: number }
const MAX_ATTEMPTS = 8;
const safeCode = /^[a-z0-9_]{1,64}$/i;

export class WebhookQueue {
  private readonly now: () => Date;
  private readonly random: () => number;
  private readonly maxAttempts: number;
  private readonly lockTimeoutMs: number;
  constructor(private readonly db: SupabaseClient, options: QueueOptions = {}) {
    this.now = options.now ?? (() => new Date()); this.random = options.random ?? Math.random;
    this.maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS; this.lockTimeoutMs = options.lockTimeoutMs ?? 300_000;
  }
  async enqueue(event: WebhookEvent): Promise<'enqueued' | 'duplicate'> {
    const { data, error } = await this.db.from('webhook_events').upsert(event, { onConflict: 'provider,dedupe_key', ignoreDuplicates: true }).select('id');
    if (error) throw error;
    return data?.length ? 'enqueued' : 'duplicate';
  }
  async claimBatch(limit: number, now = this.now()): Promise<QueueRow[]> {
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError('limit must be a positive integer');
    const cutoff = new Date(now.getTime() - this.lockTimeoutMs).toISOString();
    const { data, error } = await this.db.rpc('claim_webhook_events', { p_limit: limit, p_now: now.toISOString(), p_locked_before: cutoff });
    if (error) throw error;
    return (data ?? []) as QueueRow[];
  }
  async markDone(id: string): Promise<void> {
    const { error } = await this.db.from('webhook_events').update({ status: 'DONE', locked_at: null, last_error_code: null, updated_at: this.now().toISOString() }).eq('id', id).eq('status', 'PROCESSING');
    if (error) throw error;
  }
  async markFailed(id: string, errorCode: string): Promise<void> {
    if (!safeCode.test(errorCode)) throw new Error('errorCode must be a safe code, not an error message');
    const { data, error } = await this.db.from('webhook_events').select('attempts').eq('id', id).eq('status', 'PROCESSING').maybeSingle();
    if (error) throw error;
    if (!data) return;
    const attempts = Number(data.attempts) + 1, dead = attempts >= this.maxAttempts;
    const base = Math.min(3_600_000, 1_000 * 2 ** Math.min(attempts, 12));
    const delay = Math.floor(base * (0.75 + this.random() * 0.5));
    const { error: updateError } = await this.db.from('webhook_events').update({ status: dead ? 'DEAD' : 'FAILED', attempts, next_attempt_at: new Date(this.now().getTime() + delay).toISOString(), locked_at: null, last_error_code: errorCode, updated_at: this.now().toISOString() }).eq('id', id).eq('status', 'PROCESSING');
    if (updateError) throw updateError;
  }
  async requeueDead(id: string): Promise<boolean> {
    const { data, error } = await this.db.from('webhook_events').update({ status: 'PENDING', attempts: 0, next_attempt_at: this.now().toISOString(), locked_at: null, last_error_code: null, updated_at: this.now().toISOString() }).eq('id', id).eq('status', 'DEAD').select('id');
    if (error) throw error;
    return Boolean(data?.length);
  }
  async metrics(): Promise<{ pending: number; dead: number; oldestPendingAgeSeconds: number }> {
    const { data, error } = await this.db.rpc('webhook_queue_metrics', { p_now: this.now().toISOString() });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return { pending: Number(row?.pending ?? 0), dead: Number(row?.dead ?? 0), oldestPendingAgeSeconds: Number(row?.oldest_pending_age_seconds ?? 0) };
  }
}
