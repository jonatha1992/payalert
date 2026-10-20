import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getServiceClient } from '@/lib/server/session';
import { transitionCharge, type HubCharge } from '@/lib/server/hubCharges';
import { deleteStaleCreatingClaims, reconcileStaleRefund } from '@/lib/server/hubRefund';

type TickCharge = HubCharge & { client_apps: import('@/lib/server/clientApps').ClientApp };
function secretMatches(expected: string, actual: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && timingSafeEqual(left, right);
}
async function expireCharge(row: Pick<HubCharge, 'id'>): Promise<boolean> {
  return !!(await transitionCharge(row.id, 'pending', 'expired', { last_error: null }));
}

export async function POST(request: NextRequest) {
  const secret = process.env.HUB_CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'unavailable' }, { status: 500 });
  if (!secretMatches(secret, request.headers.get('x-hub-cron-secret') ?? '')) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const db = getServiceClient();
    let expiredCount = 0;
    const staleCreating = await deleteStaleCreatingClaims(db);
    let reconciledRefunds = 0;
    const staleRefundCutoff = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data: refundRows, error: refundError } = await db.from('hub_charges').select('*,client_apps(*)').eq('status', 'refunding').lt('updated_at', staleRefundCutoff).limit(1000);
    if (refundError) throw refundError;
    for (const row of (refundRows ?? []) as TickCharge[]) {
      try {
        if (await reconcileStaleRefund(db, row)) reconciledRefunds += 1;
      } catch (error) {
        const { error: updateError } = await db.from('hub_charges').update({ last_error: error instanceof Error ? error.name : 'refund_reconcile_error' }).eq('id', row.id).eq('status', 'refunding');
        if (updateError) throw updateError;
      }
    }
    for (let batch = 0; batch < 100; batch += 1) {
      const { data: rows, error } = await db.from('hub_charges').select('*,client_apps(*)').eq('status', 'pending').lt('expires_at', new Date().toISOString()).limit(100);
      if (error) throw error;
      if (!rows?.length) break;
      for (const row of rows as TickCharge[]) if (await expireCharge(row)) expiredCount += 1;
      if (rows.length < 100) break;
    }
    return NextResponse.json({ expired: expiredCount, staleCreating, reconciledRefunds });
  } catch (error) {
    console.error('hub_tick_failed', error instanceof Error ? `${error.name}: ${error.message}` : 'unknown');
    return NextResponse.json({ error: 'tick_failed' }, { status: 500 });
  }
}
