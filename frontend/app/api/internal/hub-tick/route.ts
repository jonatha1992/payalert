import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getServiceClient } from '@/lib/server/session';
import { firebaseForClientApp } from '@/lib/server/firebaseAdmin';
import { transitionCharge, type HubCharge } from '@/lib/server/hubCharges';
import type { ClientApp } from '@/lib/server/clientApps';

type TickCharge = HubCharge & { client_apps: ClientApp };
const syncUpdates: Record<HubCharge['status'], Record<string, string> | null> = {
  creating: null,
  pending: null,
  approved: { status: 'confirmada', 'pago.estado': 'aprobado' },
  refunding: null,
  rejected: { 'pago.estado': 'rechazado' },
  expired: { status: 'expirada', 'pago.estado': 'rechazado' },
  refunded: { status: 'reembolsada', 'pago.estado': 'reembolsado' },
  needs_refund: null,
};
function secretMatches(expected: string, actual: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && timingSafeEqual(left, right);
}
async function expireCharge(row: TickCharge): Promise<boolean> {
  const claimed = await transitionCharge(row.id, 'pending', 'expired', { firestore_synced: false, last_error: null });
  if (!claimed) return false;
  const { firestore } = firebaseForClientApp(row.client_apps);
  const bookingRef = firestore.collection('bookings').doc(row.booking_id);
  let synced = false;
  await firestore.runTransaction(async (transaction) => {
    const booking = await transaction.get(bookingRef);
    if (booking.data()?.status !== 'pendiente') return;
    const slots = await transaction.get(firestore.collection('slots').where('bookingId', '==', row.booking_id));
    transaction.update(bookingRef, { status: 'expirada', pagoExpiradoEn: new Date() });
    slots.docs.filter((slot) => slot.data()?.bookingId === row.booking_id).forEach((slot) => transaction.delete(slot.ref));
    synced = true;
  });
  if (!synced) return false;
  const { error } = await getServiceClient().from('hub_charges').update({ firestore_synced: true, last_error: null, updated_at: new Date().toISOString() }).eq('id', row.id).eq('status', 'expired');
  if (error) throw error;
  return true;
}
async function syncCharge(row: TickCharge): Promise<void> {
  const { firestore } = firebaseForClientApp(row.client_apps);
  const bookingRef = firestore.collection('bookings').doc(row.booking_id);
  const updates = syncUpdates[row.status];
  if (row.status === 'creating' || row.status === 'pending' || row.status === 'refunding') return;
  if (row.status === 'needs_refund') {
    const { error } = await getServiceClient().from('hub_charges').update({ firestore_synced: true, last_error: null, updated_at: new Date().toISOString() }).eq('id', row.id).eq('status', row.status);
    if (error) throw error;
    return;
  }
  await firestore.runTransaction(async (transaction) => {
    const booking = await transaction.get(bookingRef);
    if (!booking.exists) throw new Error('booking_missing');
    if (!updates) throw new Error(`Unsupported charge status: ${row.status}`);
    transaction.update(bookingRef, updates);
  });
  const { error } = await getServiceClient().from('hub_charges').update({ firestore_synced: true, last_error: null, updated_at: new Date().toISOString() }).eq('id', row.id).eq('status', row.status);
  if (error) throw error;
}
export async function POST(request: NextRequest) {
  const secret = process.env.HUB_CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'unavailable' }, { status: 500 });
  if (!secretMatches(secret, request.headers.get('x-hub-cron-secret') ?? '')) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const db = getServiceClient();
    let expiredCount = 0;
    for (let batch = 0; batch < 100; batch += 1) {
      const { data: rows, error } = await db.from('hub_charges').select('*,client_apps(*)').eq('status', 'pending').lt('expires_at', new Date().toISOString()).limit(100);
      if (error) throw error;
      if (!rows?.length) break;
      const ids = rows.map((row) => row.id);
      for (const row of rows as TickCharge[]) if (await expireCharge(row)) expiredCount += 1;
      if (rows.length < 100) break;
      const { data: remaining, error: remainingError } = await db.from('hub_charges').select('id').eq('status', 'pending').lt('expires_at', new Date().toISOString()).in('id', ids);
      if (remainingError) throw remainingError;
      if (remaining?.length) break;
    }
    let retriedCount = 0;
    for (let batch = 0; batch < 100; batch += 1) {
      const { data: rows, error } = await db.from('hub_charges').select('*,client_apps(*)').eq('firestore_synced', false).order('id').limit(100);
      if (error) throw error;
      if (!rows?.length) break;
      for (const row of rows as TickCharge[]) {
        try {
          await syncCharge(row);
          retriedCount += 1;
        } catch (error) {
          const { error: updateError } = await db.from('hub_charges').update({ last_error: error instanceof Error ? error.name : 'sync_error' }).eq('id', row.id).eq('status', row.status);
          if (updateError) throw updateError;
        }
      }
      if (rows.length < 100) break;
    }
    return NextResponse.json({ expired: expiredCount, retried: retriedCount });
  } catch (error) {
    console.error('hub_tick_failed', error instanceof Error ? `${error.name}: ${error.message}` : 'unknown');
    return NextResponse.json({ error: 'tick_failed' }, { status: 500 });
  }
}
