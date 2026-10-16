import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { WebhookQueue } from '@/lib/server/webhookQueue';
import { processBatch } from '@/lib/server/webhookWorker';
import { getServiceClient } from '@/lib/server/session';

export function authorizeCron(provided: string | null, secret: string | undefined): 200 | 401 | 503 {
  if (!secret) return 503;
  if (!provided?.startsWith('Bearer ')) return 401;
  const token = Buffer.from(provided.slice(7));
  const expected = Buffer.from(secret);
  return token.length === expected.length && timingSafeEqual(token, expected) ? 200 : 401;
}

async function handler(request: NextRequest) {
  const status = authorizeCron(request.headers.get('authorization'), process.env.CRON_SECRET);
  if (status !== 200) return NextResponse.json({ error: status === 503 ? 'cron_not_configured' : 'unauthorized' }, { status });
  try {
    const result = await processBatch({ queue: new WebhookQueue(getServiceClient()) });
    return NextResponse.json(result);
  } catch {
    console.error(JSON.stringify({ event: 'webhook_worker_batch_failed' }));
    return NextResponse.json({ error: 'worker_failed' }, { status: 500 });
  }
}

export const GET = handler;
export const POST = handler;
