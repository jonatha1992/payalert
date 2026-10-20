import { NextRequest, NextResponse } from 'next/server';
import { authenticateClientApp } from '@/lib/server/hubAuth';
import { findCharge } from '@/lib/server/hubCharges';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { app, response } = await authenticateClientApp(request);
  if (response) return response;

  const { id: bookingId } = await params;
  if (!bookingId) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const charge = await findCharge(app.id, bookingId);
  if (!charge) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({
    status: charge.status,
    amount: charge.amount,
    expiresAt: charge.expires_at,
    ...(charge.payment_id ? { paymentId: charge.payment_id } : {}),
  });
}
