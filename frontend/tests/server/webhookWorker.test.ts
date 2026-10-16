import { describe, expect, it, vi } from 'vitest';
import { processBatch } from '@/lib/server/webhookWorker';
import type { QueueRow } from '@/lib/server/webhookQueue';

const event = (attempts = 0): QueueRow => ({ id: 'evt-1', provider: 'uala', connection_id: 'conn-1', dedupe_key: 'order-1',
  payload: { rawBody: '{}', headers: {}, query: {} }, status: 'PROCESSING', attempts, next_attempt_at: '', locked_at: null, created_at: '', last_error_code: null });
function deps(row: QueueRow, fail = false) {
  return { queue: { claimBatch: vi.fn(async () => [row]), markDone: vi.fn(), markFailed: vi.fn() },
    process: fail ? vi.fn(async () => { throw new Error('private token must not leak'); }) : vi.fn(async () => undefined) };
}

describe('webhook worker', () => {
  it('marks a successfully processed event done', async () => {
    const d = deps(event());
    expect(await processBatch(d)).toEqual({ claimed: 1, done: 1, failed: 0, dead: 0 });
    expect(d.queue.markDone).toHaveBeenCalledWith('evt-1');
    expect(d.queue.markFailed).not.toHaveBeenCalled();
  });
  it('marks failed events with a safe code and counts the dead threshold', async () => {
    const d = deps(event(7), true);
    expect(await processBatch(d)).toEqual({ claimed: 1, done: 0, failed: 1, dead: 1 });
    expect(d.queue.markFailed).toHaveBeenCalledWith('evt-1', 'processing_failed');
  });
  it('increments attempts/backoff and moves to DEAD on the configured final attempt', async () => {
    const { WebhookQueue } = await import('@/lib/server/webhookQueue');
    const row = event(7);
    let update: Record<string, unknown> = {};
    const query: any = {
      select: () => query, update: (patch: Record<string, unknown>) => { update = patch; return query; },
      eq: () => query, maybeSingle: async () => ({ data: { attempts: row.attempts }, error: null }),
      then: (resolve: (value: unknown) => unknown) => resolve({ error: null }),
    };
    const db = { from: () => query } as never;
    const queue = new WebhookQueue(db, { now: () => new Date(0), random: () => 0.5, maxAttempts: 8 });
    await queue.markFailed(row.id, 'processing_failed');
    expect(update).toMatchObject({ status: 'DEAD', attempts: 8, last_error_code: 'processing_failed' });
    expect(Date.parse(String(update.next_attempt_at))).toBeGreaterThan(0);
  });
});
