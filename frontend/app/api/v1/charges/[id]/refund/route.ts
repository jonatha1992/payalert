import { NextRequest, NextResponse } from 'next/server';
import { loadClientApp, originAllowed } from '@/lib/server/clientApps';
import { firebaseForClientApp } from '@/lib/server/firebaseAdmin';
import { findCharge, transitionCharge } from '@/lib/server/hubCharges';
import { completeRefund } from '@/lib/server/hubRefund';
import { corsHeaders, AUTH_SCHEME } from '@/lib/server/hubHttp';
import { getServiceClient } from '@/lib/server/session';
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
    if (!charge || !['approved', 'refunding'].includes(charge.status) || !charge.payment_id) return NextResponse.json({ error: 'payment_not_refundable' }, { status: 409, headers });
    const booking = await firestore.collection('bookings').doc(bookingId).get();
    if (!booking.exists) return NextResponse.json({ error: 'booking_not_found' }, { status: 404, headers });
    if (!refundable(booking.data()?.date, booking.data()?.time, Date.now())) return NextResponse.json({ error: 'refund_window_closed' }, { status: 409, headers });
    if (charge.status === 'approved') {
      const claimed = await transitionCharge(charge.id, 'approved', 'refunding', { firestore_synced: false, last_error: null });
      if (!claimed) return NextResponse.json({ error: 'payment_not_refundable' }, { status: 409, headers });
    }
    chargeId = charge.id;
    const result = await completeRefund({ ...charge, booking_id: bookingId, client_apps: app }, getServiceClient());
    if (result === 'rejected') {
      chargeId = null;
      return NextResponse.json({ error: 'refund_failed' }, { status: 400, headers });
    }
    if (result === 'uncertain') throw new Error('Mercado Pago refund outcome unavailable');
    chargeId = null;
    return NextResponse.json({ status: 'refunded' }, { headers });
  } catch (error) {
    // Keep the CAS claim: the remote refund may have succeeded before this failure.
    console.error('hub_refund_failed', error instanceof Error ? error.name : 'unknown');
    return chargeId ? NextResponse.json({ status: 'refunding' }, { status: 202, headers }) : NextResponse.json({ error: 'refund_failed' }, { status: 500, headers });
  }
}

