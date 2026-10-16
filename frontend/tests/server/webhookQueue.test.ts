import { describe, expect, it, vi } from 'vitest';
import { WebhookQueue } from '@/lib/server/webhookQueue';

function mockDb() {
  const rows: Record<string, any> = {};
  const db: any = {
    rows,
    from: vi.fn(() => {
      let id: string | undefined, status: string | undefined, patch: any, upsertDuplicate = false;
      const q: any = {
        upsert: vi.fn((row: any, options?: { ignoreDuplicates?: boolean }) => { upsertDuplicate = Object.values(rows).some((r) => r.provider === row.provider && r.dedupe_key === row.dedupe_key); if (!upsertDuplicate) rows[row.id] = { ...row, status: 'PENDING', attempts: 0, next_attempt_at: new Date(0).toISOString(), created_at: new Date(0).toISOString() }; else upsertDuplicate = options?.ignoreDuplicates === true; return q; }),
        select: vi.fn(() => q), update: vi.fn((value: any) => { patch = value; return q; }), eq: vi.fn((key: string, value: string) => { if (key === 'id') id = value; if (key === 'status') status = value; return q; }),
        maybeSingle: vi.fn(async () => ({ data: rows[id!] && (!status || rows[id!].status === status) ? rows[id!] : null, error: null })),
        then: (resolve: any) => resolve({ data: upsertDuplicate ? [] : Object.values(rows).filter((r: any) => !id || (r.id === id && (!status || r.status === status))).map((r: any) => ({ id: r.id })), error: null }),
      };
      q.update = vi.fn((value: any) => { patch = value; q.then = (resolve: any) => { if (rows[id!] && (!status || rows[id!].status === status)) Object.assign(rows[id!], patch); resolve({ data: rows[id!] ? [{ id }] : [], error: null }); }; return q; });
      return q;
    }),
    rpc: vi.fn(async (fn: string) => fn === 'webhook_queue_metrics' ? ({ data: [{ pending: 0, dead: 0, oldest_pending_age_seconds: 0 }], error: null }) : ({ data: [], error: null })),
  };
  return db;
}
const event = (id: string) => ({ id, provider: 'mock', connection_id: 'c', dedupe_key: id, payload: { safe: true } });

describe('WebhookQueue', () => {
  it('enqueues idempotently', async () => { const db = mockDb(); const q = new WebhookQueue(db); expect(await q.enqueue(event('a'))).toBe('enqueued'); expect(await q.enqueue(event('a'))).toBe('duplicate'); });
  it('stores only a safe error code and backs off', async () => { const db = mockDb(); const q = new WebhookQueue(db, { now: () => new Date(1000), random: () => 0.5 }); await q.enqueue(event('a')); db.rows.a.status = 'PROCESSING'; await q.markFailed('a', 'provider_unavailable'); expect(db.rows.a.last_error_code).toBe('provider_unavailable'); expect(Date.parse(db.rows.a.next_attempt_at)).toBeGreaterThan(1000); });
  it('rejects raw error messages', async () => { const q = new WebhookQueue(mockDb()); await expect(q.markFailed('a', 'token=secret')).rejects.toThrow(); });
  it('requeues dead items and exposes metrics', async () => { const db = mockDb(); const q = new WebhookQueue(db); await q.enqueue(event('a')); db.rows.a.status = 'DEAD'; expect(await q.requeueDead('a')).toBe(true); expect(db.rows.a.status).toBe('PENDING'); expect((await q.metrics()).pending).toBe(0); });
  it('uses the atomic claim RPC for concurrent workers', async () => { const db = mockDb(); const q = new WebhookQueue(db); const results = await Promise.all([q.claimBatch(1), q.claimBatch(1)]); expect(results.flat()).toEqual([]); expect(db.rpc).toHaveBeenCalledTimes(2); });
});
