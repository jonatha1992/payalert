import type { PaymentHint } from './filter';

export type QueueEntry = { hint: PaymentHint; attempts: number; nextAttemptAt: number; status: 'pending' | 'sent' | 'error' };
export interface QueueStore { read(): Promise<QueueEntry[]>; write(entries: QueueEntry[]): Promise<void> }

export class NotificationQueue {
  constructor(private readonly store: QueueStore, private readonly send: (hint: PaymentHint) => Promise<void>, private readonly now = Date.now) {}
  async enqueue(hint: PaymentHint): Promise<void> {
    const entries = await this.store.read();
    if (entries.some((entry) => entry.hint.notificationKey === hint.notificationKey)) return;
    entries.unshift({ hint, attempts: 0, nextAttemptAt: this.now(), status: 'pending' });
    await this.store.write(entries.slice(0, 100));
  }
  async flush(): Promise<void> {
    const entries = await this.store.read();
    for (const entry of entries) {
      if (entry.status === 'sent' || entry.nextAttemptAt > this.now()) continue;
      try {
        await this.send(entry.hint);
        entry.status = 'sent';
      } catch {
        entry.attempts += 1;
        entry.status = entry.attempts >= 8 ? 'error' : 'pending';
        entry.nextAttemptAt = this.now() + Math.min(60_000 * 2 ** (entry.attempts - 1), 3_600_000);
      }
      await this.store.write(entries);
    }
  }
}
