import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getServiceClient } from '@/lib/server/session';
import { firebaseForClientApp } from '@/lib/server/firebaseAdmin';
import { transitionCharge, type HubCharge } from '@/lib/server/hubCharges';
import type { ClientApp } from '@/lib/server/clientApps';

type TickCharge = HubCharge & { client_apps: ClientApp };
type Database = ReturnType<typeof getServiceClient>;
function secretMatches(expected: string, actual: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  return left.length === right.length && timingSafeEqual(left, right);
}
async function expireCharge(db: Database, row: TickCharge): Promise<void> {
  const { firestore } = firebaseForClientApp(row.client_apps);
  const bookingRef = firestore.collection('bookings').doc(row.booking_id);
  const booking = await bookingRef.get();
  if (booking.exists && booking.data()?.status === 'pendiente') {
    await bookingRef.update({ status: 'expirada', pagoExpiradoEn: new Date() });
    const slots = await firestore.collection('slots').where('bookingId', '==', row.booking_id).get();
    const ownedSlots = slots.docs.filter((slot) => slot.data()?.bookingId === row.booking_id);
    const batch = firestore.batch();
    ownedSlots.forEach((slot) => batch.delete(slot.ref));
    if (ownedSlots.length) await batch.commit();
  }
  await transitionCharge(row.id, 'pending', 'expired', { firestore_synced: true, last_error: null });
}
async function syncCharge(row: TickCharge): Promise<void> {
  const { firestore } = firebaseForClientApp(row.client_apps);
  const bookingRef = firestore.collection('bookings').doc(row.booking_id);
  const snap = await bookingRef.get();
  if (!snap.exists) throw new Error('booking_missing');
  const booking = snap.data()!;
  const approved = row.status === 'approved';
  const confirm = approved && booking.status === 'pendiente' && Date.parse(row.expires_at) > Date.now();
  await bookingRef.update({ ...(confirm ? { status: 'confirmada' } : {}), 'pago.estado': approved ? 'aprobado' : 'rechazado' });
  await transitionCharge(row.id, row.status, row.status as 'pending' | 'approved' | 'rejected' | 'expired' | 'refunded' | 'needs_refund', { firestore_synced: true, last_error: null });
}
export async function POST(request: NextRequest) {
  const secret = process.env.HUB_CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'unavailable' }, { status: 500 });
  if (!secretMatches(secret, request.headers.get('x-hub-cron-secret') ?? '')) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const db = getServiceClient();
    const { data: expired, error } = await db.from('hub_charges').select('*,client_apps(*)').eq('status', 'pending').lt('expires_at', new Date().toISOString()).limit(100);
    if (error) throw error;
    const expiredIds = new Set((expired ?? []).map((row) => row.id));
    for (const row of (expired ?? []) as TickCharge[]) await expireCharge(db, row);
    const { data: retry, error: retryError } = await db.from('hub_charges').select('*,client_apps(*)').eq('firestore_synced', false).limit(100);
    if (retryError) throw retryError;
    for (const row of (retry ?? []) as TickCharge[]) {
      if (expiredIds.has(row.id)) continue;
      try { await syncCharge(row); }
      catch (error) { await db.from('hub_charges').update({ last_error: error instanceof Error ? error.name : 'sync_error' }).eq('id', row.id); }
    }
    return NextResponse.json({ expired: expired?.length ?? 0, retried: retry?.length ?? 0 });
  } catch (error) {
    console.error('hub_tick_failed', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'tick_failed' }, { status: 500 });
  }
}
