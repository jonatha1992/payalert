import { MAX_ATTEMPTS, type QueueRow } from '@/lib/server/webhookQueue';
import type { Provider, WebhookRequest } from '@/lib/payments/types';
import { processWebhook } from '@/lib/server/webhookHandler';
import { WebhookQueue } from '@/lib/server/webhookQueue';

export interface WebhookWorkerDependencies {
  queue: Pick<WebhookQueue, 'claimBatch' | 'markDone' | 'markFailed'>;
  process?: (provider: Provider, request: WebhookRequest) => Promise<unknown>;
}
export interface WebhookWorkerResult { claimed: number; done: number; failed: number; dead: number }

function failureCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    && /^[a-z0-9_]{1,64}$/i.test(error.code)) return error.code.toLowerCase();
  return 'processing_failed';
}

export async function processBatch(deps: WebhookWorkerDependencies, limit = 25): Promise<WebhookWorkerResult> {
  const events = await deps.queue.claimBatch(limit);
  const result = { claimed: events.length, done: 0, failed: 0, dead: 0 };
  for (const event of events) {
    try {
      if (!event.id) throw new Error('claimed_event_missing_id');
      const payload = event.payload as WebhookRequest;
      await (deps.process ?? processWebhook)(event.provider as Provider, payload);
      if (!event.id) throw new Error('claimed_event_missing_id');
      await deps.queue.markDone(event.id);
      result.done += 1;
    } catch (error) {
      const code = failureCode(error);
      await deps.queue.markFailed(event.id, code);
      result.failed += 1;
      if (event.attempts + 1 >= MAX_ATTEMPTS) result.dead += 1;
      console.error(JSON.stringify({ event: 'webhook_processing_failed', eventId: event.id, provider: event.provider, code }));
    }
  }
  return result;
}

export type ClaimedWebhookEvent = QueueRow;
