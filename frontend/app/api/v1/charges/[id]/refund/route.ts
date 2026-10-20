import { NextRequest, NextResponse } from 'next/server';
import { authenticateClientApp } from '@/lib/server/hubAuth';
import { findCharge, transitionCharge } from '@/lib/server/hubCharges';
import { completeRefund } from '@/lib/server/hubRefund';
import { corsHeaders } from '@/lib/server/hubHttp';
import { getServiceClient } from '@/lib/server/session';

const DAY_MS = 86_400_000;

export async function OPTIONS(request: NextRequest) {
  const auth = await authenticateClientApp(request);
  return auth.app ? new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get('origin')!) }) : auth.response!;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateClientApp(request);
  if (!auth.app) return auth.response!;
  const headers = corsHeaders(request.headers.get('origin')!);
  let chargeId: string | null = null;
  try {
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'invalid_request' }, { status: 400, headers }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'invalid_request' }, { status: 400, headers });
    const eventStartsAt = (body as { eventStartsAt?: unknown }).eventStartsAt;
    if (eventStartsAt !== undefined && (typeof eventStartsAt !== 'string' || !Number.isFinite(Date.parse(eventStartsAt)) || Date.parse(eventStartsAt) - Date.now() < DAY_MS)) {
      return NextResponse.json({ error: 'refund_window_closed' }, { status: 409, headers });
    }
    const { id: bookingId } = await params;
    if (!bookingId) return NextResponse.json({ error: 'payment_not_refundable' }, { status: 409, headers });
    const charge = await findCharge(auth.app.id, bookingId);
    if (!charge || !['approved', 'refunding'].includes(charge.status) || !charge.payment_id) return NextResponse.json({ error: 'payment_not_refundable' }, { status: 409, headers });
    const claimed = charge.status === 'refunding' || await transitionCharge(charge.id, 'approved', 'refunding', { last_error: null });
    if (!claimed) return NextResponse.json({ error: 'payment_not_refundable' }, { status: 409, headers });
    chargeId = charge.id;
    const result = await completeRefund({ ...charge, client_apps: auth.app }, getServiceClient());
    if (result === 'rejected') {
      chargeId = null;
      return NextResponse.json({ error: 'refund_failed' }, { status: 400, headers });
    }
    if (result === 'uncertain') return NextResponse.json({ status: 'refunding' }, { status: 202, headers });
    chargeId = null;
    return NextResponse.json({ status: 'refunded' }, { headers });
  } catch (error) {
    console.error('hub_refund_failed', error instanceof Error ? error.name : 'unknown');
    return chargeId ? NextResponse.json({ status: 'refunding' }, { status: 202, headers }) : NextResponse.json({ error: 'refund_failed' }, { status: 500, headers });
  }
}

