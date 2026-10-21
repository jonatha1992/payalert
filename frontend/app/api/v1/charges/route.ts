import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { originAllowedForAnyApp } from '@/lib/server/clientApps';
import { authenticateClientApp } from '@/lib/server/hubAuth';
import { claimCharge, updateCreatingCharge } from '@/lib/server/hubCharges';
import { corsHeaders } from '@/lib/server/hubHttp';
import { getServiceClient } from '@/lib/server/session';
import { decryptSecret } from '@/lib/payments/secretBox';

function jsonError(error: string, status: number, headers: Record<string, string> = {}) { return NextResponse.json({ error }, { status, headers }); }
function validBody(value: unknown): value is { bookingId: string; payerRef: string; payerEmail?: string; returnUrl: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  return typeof body.bookingId === 'string' && !!body.bookingId.trim()
    && typeof body.payerRef === 'string' && !!body.payerRef.trim()
    && (body.payerEmail === undefined || typeof body.payerEmail === 'string')
    && typeof body.returnUrl === 'string' && !!body.returnUrl.trim();
}
function configuredDeposit(value: unknown): number { return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 1_000_000 ? value : 5000; }
async function deleteCreatingClaim(id: string) {
  const { error } = await getServiceClient().from('hub_charges').delete().eq('id', id).eq('status', 'creating');
  if (error) throw error;
}
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin || !await originAllowedForAnyApp(origin)) return new NextResponse(null, { status: 403 });
  const requestedHeaders = request.headers.get('access-control-request-headers')?.split(',').map((header) => header.trim().toLowerCase()) ?? [];
  if (requestedHeaders.some((header) => !['authorization', 'content-type'].includes(header))) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const auth = await authenticateClientApp(request);
  if (!auth.app) return auth.response!;
  const app = auth.app;
  const headers = origin ? corsHeaders(origin) : {};
  let claimedId: string | null = null;
  try {
    let body: unknown;
    try { body = await request.json(); } catch { return jsonError('invalid_request', 400, headers); }
    if (!validBody(body)) return jsonError('invalid_request', 400, headers);
    if (!app.allowed_origins.some((allowed) => body.returnUrl.startsWith(allowed))) return jsonError('return_url_denied', 400, headers);
    const amount = configuredDeposit(app.deposit_default);
    if (!app.connection_id) return jsonError('connection_unavailable', 409, headers);
    const { data: connection, error: connectionError } = await getServiceClient().from('payment_connections')
      .select('provider,status,credentials_encrypted').eq('id', app.connection_id).eq('business_id', app.business_id).maybeSingle();
    if (connectionError || !connection || connection.provider !== 'mercadopago' || connection.status !== 'active') return NextResponse.json({ error: 'connection_unavailable' }, { status: 409, headers });
    const credentials = JSON.parse(decryptSecret(connection.credentials_encrypted)) as { access_token?: string };
    const token = credentials.access_token?.trim();
    if (!token) return NextResponse.json({ error: 'connection_unavailable' }, { status: 409, headers });
    const expires = new Date(Date.now() + 15 * 60_000);
    const externalReference = randomUUID();
    const idempotencyKey = `${app.id}:${body.bookingId}`;
    const claim = await claimCharge({ client_app_id: app.id, booking_id: body.bookingId, external_reference: externalReference, amount, currency: 'ARS', expires_at: expires.toISOString(), idempotency_key: idempotencyKey, payer_ref: body.payerRef, return_url: body.returnUrl });
    if (!claim.created) {
      if (claim.charge.init_point) return NextResponse.json({ chargeId: claim.charge.id, checkoutUrl: claim.charge.init_point, expiresAt: claim.charge.expires_at, status: claim.charge.status }, { headers });
      return jsonError('charge_in_progress', 409, headers);
    }
    claimedId = claim.charge.id;
    const payload = {
      items: [{ title: 'Seña', quantity: 1, currency_id: 'ARS', unit_price: amount }],
      payer: body.payerEmail ? { email: body.payerEmail } : undefined,
      external_reference: externalReference,
      notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago`,
      back_urls: { success: body.returnUrl, failure: body.returnUrl, pending: body.returnUrl },
      auto_return: 'approved', expires: true, date_of_expiration: expires.toISOString(),
    };
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': idempotencyKey }, body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Mercado Pago preference request failed (${response.status})`);
    const preference: unknown = await response.json();
    if (!preference || typeof preference !== 'object' || typeof (preference as { id?: unknown }).id !== 'string' || typeof (preference as { init_point?: unknown }).init_point !== 'string') throw new Error('Mercado Pago returned an invalid preference');
    const validPreference = preference as { id: string; init_point: string };
    await updateCreatingCharge(claimedId, { preference_id: validPreference.id, init_point: validPreference.init_point });
    claimedId = null;
    return NextResponse.json({ chargeId: claim.charge.id, checkoutUrl: validPreference.init_point, expiresAt: expires.toISOString(), status: 'pending' }, { headers });
  } catch (error) {
    if (claimedId) {
      try { await deleteCreatingClaim(claimedId); } catch (deleteError) { console.error('hub_charge_claim_delete_failed', deleteError instanceof Error ? deleteError.name : 'unknown'); }
    }
    console.error('hub_charge_create_failed', error instanceof Error ? error.name : 'unknown');
    return jsonError('charge_creation_failed', 500, headers);
  }
}
