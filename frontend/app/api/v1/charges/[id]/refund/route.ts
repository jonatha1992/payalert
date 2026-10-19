import { NextRequest, NextResponse } from 'next/server';
import { loadClientApp, originAllowed } from '@/lib/server/clientApps';
import { firebaseForClientApp } from '@/lib/server/firebaseAdmin';
import { findCharge, transitionCharge } from '@/lib/server/hubCharges';
import { corsHeaders, AUTH_SCHEME } from '@/lib/server/hubHttp';
import { getServiceClient } from '@/lib/server/session';
import { decryptSecret } from '@/lib/payments/secretBox';
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';

const DAY_MS = 86_400_000;
const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const TIME_FORMAT = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidDate(date: string): boolean {
  if (date !== date.trim() || !DATE_FORMAT.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function refundable(date: unknown, time: unknown, now: number): boolean {
  if (typeof date !== 'string' || typeof time !== 'string' || !isValidDate(date) || !TIME_FORMAT.test(time)) return false;
  const timestamp = new Date(`${date}T${time}:00-03:00`).getTime();
  return Number.isFinite(timestamp) && timestamp - now >= DAY_MS;
}

type RefundFirestore = {
  collection: (name: string) => { doc: (id: string) => DocumentReference };
  runTransaction: <T>(callback: (transaction: Transaction) => Promise<T>) => Promise<T>;
};


async function updateRefundedBooking(firestore: RefundFirestore, bookingId: string): Promise<void> {
  const bookingRef = firestore.collection('bookings').doc(bookingId);
  await firestore.runTransaction(async (transaction) => {
    const booking = await transaction.get(bookingRef);
    if (booking.data()?.status !== 'pendiente') throw new Error('booking_not_pending');
    transaction.update(bookingRef, { status: 'reembolsada', 'pago.estado': 'reembolsado' });
  });
}

export async function OPTIONS(request: NextRequest) {
  const app = await loadClientApp(request.nextUrl.searchParams.get('app') ?? '');
  const origin = request.headers.get('origin');
  return app && originAllowed(app, origin) ? new NextResponse(null, { status: 204, headers: corsHeaders(origin!) }) : new NextResponse(null, { status: 403 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get('origin');
  let headers: Record<string, string> = {};
  let chargeId: string | null = null;
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body) || typeof (body as { app?: unknown }).app !== 'string') {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }
    const { id: bookingId } = await params;
    const app = await loadClientApp((body as { app: string }).app);
    if (!bookingId || !app) return NextResponse.json({ error: 'unknown_app' }, { status: 404 });
    if (!originAllowed(app, origin)) return NextResponse.json({ error: 'origin_denied' }, { status: 403 });
    headers = corsHeaders(origin!);
    const bearer = request.headers.get('authorization')?.match(new RegExp(`^${AUTH_SCHEME}\\s+(.+)$`, 'i'))?.[1];
    if (!bearer) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers });
    const { auth, firestore } = firebaseForClientApp(app);
    let decoded;
    try {
      decoded = await auth.verifyIdToken(bearer);
    } catch {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers });
    }
    if (!decoded.email_verified || !decoded.email || !(app.admin_emails ?? []).some((email) => email.toLowerCase() === decoded.email!.toLowerCase())) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403, headers });
    }
    const charge = await findCharge(app.id, bookingId);
    if (!charge || charge.status !== 'approved' || !charge.payment_id) return NextResponse.json({ error: 'payment_not_refundable' }, { status: 409, headers });
    const booking = await firestore.collection('bookings').doc(bookingId).get();
    if (!booking.exists) return NextResponse.json({ error: 'booking_not_found' }, { status: 404, headers });
    if (!refundable(booking.data()?.date, booking.data()?.time, Date.now())) return NextResponse.json({ error: 'refund_window_closed' }, { status: 409, headers });
    const claimed = await transitionCharge(charge.id, 'approved', 'refunding', { firestore_synced: false, last_error: null });
    if (!claimed) return NextResponse.json({ error: 'payment_not_refundable' }, { status: 409, headers });
    chargeId = charge.id;
    const { data: connection, error } = await getServiceClient().from('payment_connections').select('credentials_encrypted').eq('id', app.connection_id).eq('business_id', app.business_id).single();
    if (error) throw error;
    const credentials = JSON.parse(decryptSecret(connection.credentials_encrypted)) as { access_token: string };
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(charge.payment_id)}/refunds`, {
          method: 'POST',
          headers: { Authorization: `${AUTH_SCHEME} ${credentials.access_token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': `refund:${app.id}:${bookingId}` },
      body: JSON.stringify({ amount: charge.amount / 100 }),
    });
    const refund = await response.json() as { status?: unknown };
    if (!response.ok || refund.status !== 'approved') throw new Error(`Mercado Pago refund failed (${response.status})`);
    await updateRefundedBooking(firestore, bookingId);
    const completed = await transitionCharge(charge.id, 'refunding', 'refunded', { firestore_synced: true, last_error: null });
    if (!completed) throw new Error('refund_charge_transition_lost');
    chargeId = null;
    return NextResponse.json({ status: 'refunded' }, { headers });
  } catch (error) {
    if (chargeId) await transitionCharge(chargeId, 'refunding', 'approved', { last_error: error instanceof Error ? error.name : 'refund_failed' });
    console.error('hub_refund_failed', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'refund_failed' }, { status: 500, headers });
  }
}

