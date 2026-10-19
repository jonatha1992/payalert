import { NextRequest, NextResponse } from 'next/server';
import { loadClientApp, originAllowed } from '@/lib/server/clientApps';
import { firebaseForClientApp } from '@/lib/server/firebaseAdmin';
import { findCharge, transitionCharge } from '@/lib/server/hubCharges';
import { getServiceClient } from '@/lib/server/session';

const cors = (origin: string) => ({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', Vary: 'Origin' });
const DAY_MS = 86_400_000;
function refundable(date: unknown, time: unknown, now: number): boolean {
  if (typeof date !== 'string' || typeof time !== 'string') return false;
  const timestamp = new Date(`${date}T${time}:00-03:00`).getTime();
  return Number.isFinite(timestamp) && timestamp - now >= DAY_MS;
}

export async function OPTIONS(request: NextRequest) {
  const app = await loadClientApp(request.nextUrl.searchParams.get('app') ?? '');
  const origin = request.headers.get('origin');
  return app && originAllowed(app, origin) ? new NextResponse(null, { status: 204, headers: cors(origin!) }) : new NextResponse(null, { status: 403 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get('origin');
  let headers: Record<string, string> = {};
  try {
    const { id: bookingId } = await params;
    const body = await request.json() as { app?: unknown };
    if (!bookingId || typeof body.app !== 'string') return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    const app = await loadClientApp(body.app);
    if (!app) return NextResponse.json({ error: 'unknown_app' }, { status: 404 });
    if (!originAllowed(app, origin)) return NextResponse.json({ error: 'origin_denied' }, { status: 403 });
    headers = cors(origin!);
    const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!bearer) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers });
    const { auth, firestore } = firebaseForClientApp(app);
    let decoded;
    try { decoded = await auth.verifyIdToken(bearer); } catch { return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers }); }
    const admins = app.admin_emails ?? [];
    if (!decoded.email_verified || !decoded.email || !admins.some((email) => email.toLowerCase() === decoded.email!.toLowerCase())) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers });
    const charge = await findCharge(app.id, bookingId);
    if (!charge || charge.status !== 'approved' || !charge.payment_id) return NextResponse.json({ error: 'payment_not_refundable' }, { status: 409, headers });
    const bookingRef = firestore.collection('bookings').doc(bookingId);
    const snap = await bookingRef.get();
    if (!snap.exists) return NextResponse.json({ error: 'booking_not_found' }, { status: 404, headers });
    const booking = snap.data()!;
    if (!refundable(booking.date, booking.time, Date.now())) return NextResponse.json({ error: 'refund_window_closed' }, { status: 409, headers });
    const { data: connection, error } = await getServiceClient().from('payment_connections').select('credentials_encrypted').eq('id', app.connection_id).eq('business_id', app.business_id).single();
    if (error) throw error;
    const { decryptSecret } = await import('@/lib/payments/secretBox');
    const credentials = JSON.parse(decryptSecret(connection.credentials_encrypted)) as { access_token: string };
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(charge.payment_id)}/refunds`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${credentials.access_token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': `refund:${app.id}:${bookingId}` },
      body: JSON.stringify({ amount: charge.amount / 100 }),
    });
    if (!response.ok) throw new Error(`Mercado Pago refund failed (${response.status})`);
    await bookingRef.update({ status: 'reembolsada', 'pago.estado': 'reembolsado' });
    await transitionCharge(charge.id, 'approved', 'refunded');
    return NextResponse.json({ status: 'refunded' }, { headers });
  } catch (error) {
    console.error('hub_refund_failed', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'refund_failed' }, { status: 500, headers });
  }
}
