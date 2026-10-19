import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { loadClientApp, originAllowed, originAllowedForAnyApp } from '@/lib/server/clientApps';
import { firebaseForClientApp } from '@/lib/server/firebaseAdmin';
import { claimCharge, updateCreatingCharge } from '@/lib/server/hubCharges';
import { getServiceClient } from '@/lib/server/session';
import { decryptSecret } from '@/lib/payments/secretBox';

const AUTH_SCHEME = 'Bearer';
const cors = (origin: string) => ({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', Vary: 'Origin' });
const AUTH_SCHEME = 'Bearer';
function jsonError(error: string, status: number, headers: Record<string, string> = {}) { return NextResponse.json({ error }, { status, headers }); }
function validBody(value: unknown): value is { app: string; bookingId: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  return typeof body.app === 'string' && !!body.app.trim() && typeof body.bookingId === 'string' && !!body.bookingId.trim();
}
function configuredDeposit(value: unknown): number { return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 1_000_000 ? value : 5000; }
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && await originAllowedForAnyApp(origin)) return new NextResponse(null, { status: 204, headers: cors(origin) });
  return new NextResponse(null, { status: 403 });
}
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  let headers: Record<string, string> = {};
  let claimedId: string | null = null;
  try {
    let body: unknown;
    try { body = await request.json(); } catch { return jsonError('invalid_request', 400); }
    if (!validBody(body)) return jsonError('invalid_request', 400);
    const app = await loadClientApp(body.app);
    if (!app) return jsonError('unknown_app', 404);
    if (!originAllowed(app, origin)) return jsonError('origin_denied', 403);
    headers = cors(origin!);
    const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!bearer) return jsonError('unauthorized', 401, headers);
    const { auth, firestore } = firebaseForClientApp(app);
    let decoded;
    try { decoded = await auth.verifyIdToken(bearer); } catch { return jsonError('unauthorized', 401, headers); }
    const bookingRef = firestore.collection('bookings').doc(body.bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) return jsonError('booking_not_found', 404, headers);
    if (bookingSnap.data()?.uid !== decoded.uid) return jsonError('forbidden', 403, headers);
    const config = await firestore.collection('config').doc('pagos').get();
    const amount = configuredDeposit(config.data()?.senia);
    const { data: connection, error: connectionError } = await getServiceClient().from('payment_connections')
      .select('provider,status,credentials_encrypted').eq('id', app.connection_id).eq('business_id', app.business_id).single();
    if (connectionError) throw connectionError;
    if (connection.provider !== 'mercadopago' || connection.status !== 'active') return jsonError('connection_unavailable', 409, headers);
    const credentials = JSON.parse(decryptSecret(connection.credentials_encrypted)) as { access_token?: string };
    const token = credentials.access_token?.trim();
    if (!token) return jsonError('connection_unavailable', 409, headers);
    const expires = new Date(Date.now() + 15 * 60_000);
    const externalReference = randomUUID();
    const idempotencyKey = `${app.id}:${body.bookingId}`;
    const claim = await claimCharge({ client_app_id: app.id, booking_id: body.bookingId, external_reference: externalReference, amount, currency: 'ARS', expires_at: expires.toISOString(), idempotency_key: idempotencyKey });
    if (!claim.created) {
      if (claim.charge.init_point) return NextResponse.json({ init_point: claim.charge.init_point }, { headers });
      return jsonError('charge_in_progress', 409, headers);
    }
    claimedId = claim.charge.id;
    const status = await firestore.runTransaction(async (transaction) => {
      const current = await transaction.get(bookingRef);
      if (!current.exists) return 404;
      if (current.data()?.uid !== decoded.uid || current.data()?.status !== 'pendiente') return 409;
      transaction.update(bookingRef, { 'pago.estado': 'pendiente', preferenceId: 'creating', pagoVenceEn: expires });
      return 200;
    });
    if (status !== 200) return jsonError(status === 404 ? 'booking_not_found' : 'booking_not_pending', status, headers);
    const payload = {
      items: [{ title: 'Seña de turno', quantity: 1, currency_id: 'ARS', unit_price: amount }],
      external_reference: externalReference,
      notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago`,
      back_urls: {
        success: `${origin}/?pago=exito`,
        failure: `${origin}/?pago=error`,
        pending: `${origin}/?pago=pendiente`,
      },
      auto_return: 'approved',
      expires: true,
      date_of_expiration: expires.toISOString(),
    };
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `${AUTH_SCHEME} ${token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': idempotencyKey },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Mercado Pago preference request failed (${response.status})`);
    const preference: unknown = await response.json();
    if (!preference || typeof preference !== 'object' || typeof (preference as { id?: unknown }).id !== 'string' || typeof (preference as { init_point?: unknown }).init_point !== 'string') throw new Error('Mercado Pago returned an invalid preference');
    const validPreference = preference as { id: string; init_point: string };
    await updateCreatingCharge(claimedId, { preference_id: validPreference.id, init_point: validPreference.init_point });
    await firestore.runTransaction(async (transaction) => {
      const current = await transaction.get(bookingRef);
      if (current.exists && current.data()?.uid === decoded.uid && current.data()?.status === 'pendiente') transaction.update(bookingRef, { 'pago.estado': 'pendiente', preferenceId: validPreference.id, pagoVenceEn: expires });
    });
    return NextResponse.json({ init_point: validPreference.init_point, chargeId: claimedId }, { headers });
  } catch (error) {
    if (claimedId) {
      try { await updateCreatingCharge(claimedId, { last_error: error instanceof Error ? error.name : 'charge_creation_failed' }); }
      catch (updateError) { console.error('hub_charge_claim_update_failed', updateError instanceof Error ? updateError.name : 'unknown'); }
    }
    console.error('hub_charge_create_failed', error instanceof Error ? error.name : 'unknown');
    return jsonError('charge_creation_failed', 500, headers);
  }
}
