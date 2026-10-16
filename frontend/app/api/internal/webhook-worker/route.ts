import { NextRequest, NextResponse } from 'next/server';
import { WebhookQueue } from '@/lib/server/webhookQueue';
import { processBatch } from '@/lib/server/webhookWorker';
import { getServiceClient } from '@/lib/server/session';
import { authorizeCron } from '@/lib/server/cronAuth';

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
