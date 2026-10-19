import { beforeEach, describe, expect, it, vi } from 'vitest';
import { filterNotification } from '../src/notifications/filter';
import { NotificationQueue, type QueueEntry, type QueueStore } from '../src/notifications/queue';
import { createPaymentHintSender } from '../src/notifications/sender';

const hint = { packageName: 'com.mercadopago.wallet', title: 'Transferencia recibida', text: 'Aviso', postedAt: '2026-01-01T00:00:00.000Z', notificationKey: 'notice-1' };
class MemoryStore implements QueueStore {
  entries: QueueEntry[] = [];
  async read() { return structuredClone(this.entries); }
  async write(entries: QueueEntry[]) { this.entries = structuredClone(entries); }
}

describe('notification hints', () => {
  it('filters notifications to the approved package and valid identifiers', () => {
    expect(filterNotification({ packageName: 'com.evil.app', title: 'x', text: 'x', postTime: 1, key: 'k' })).toBeNull();
    expect(filterNotification({ packageName: hint.packageName, title: 'x', text: 'x', postTime: 1, key: '' })).toBeNull();
    expect(filterNotification({ packageName: hint.packageName, title: 'x', text: 'x', postTime: 1, key: 'k' })).toMatchObject({ notificationKey: 'k', postedAt: '1970-01-01T00:00:00.001Z' });
  });

  it('deduplicates queued notifications by notification key', async () => {
    const store = new MemoryStore();
    const queue = new NotificationQueue(store, async () => undefined);
    await queue.enqueue(hint);
    await queue.enqueue({ ...hint, text: 'different' });
    expect(store.entries).toHaveLength(1);
  });

  it('retries failures with exponential backoff and stops after eight attempts', async () => {
    let now = 10_000;
    const store = new MemoryStore();
    const queue = new NotificationQueue(store, async () => { throw new Error('offline'); }, () => now);
    await queue.enqueue(hint);
    await queue.flush();
    expect(store.entries[0]).toMatchObject({ attempts: 1, status: 'pending', nextAttemptAt: 70_000 });
    for (let attempt = 2; attempt <= 8; attempt += 1) {
      now = store.entries[0].nextAttemptAt;
      await queue.flush();
    }
    expect(store.entries[0]).toMatchObject({ attempts: 8, status: 'error' });
  });

  it('sends the exact API contract with bearer token and surfaces network failures', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ accepted: true }) }).mockRejectedValueOnce(new Error('offline'));
    const send = createPaymentHintSender('https://api.example.test', async () => 'token-secret', fetcher);
    await expect(send(hint)).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith('https://api.example.test/api/mobile/payment-hints', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer token-secret' }), body: JSON.stringify(hint) }));
    await expect(send(hint)).rejects.toThrow('offline');
  });
});

beforeEach(() => vi.clearAllMocks());
