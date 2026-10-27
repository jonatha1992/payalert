import 'server-only';
import { randomUUID } from 'node:crypto';
import { decryptSecret } from '@/lib/payments/secretBox';
import { computeFee } from '@/lib/server/hubFee';
import { claimCharge, updateCreatingCharge } from '@/lib/server/hubCharges';
import { getServiceClient } from '@/lib/server/session';
import type { ClientApp } from '@/lib/server/clientApps';

export async function createBrowserCharge(app: ClientApp, bookingId: string, amount: number, payerName?: string): Promise<{ init_point: string; status: 'pending' }> {
  if (!app.connection_id) throw new Error('not_connected');
  const db = getServiceClient();
  const { data: settings, error: settingsError } = await db.from('client_apps').select('fee_type,fee_value').eq('id', app.id).maybeSingle();
  const fee = computeFee(amount, settingsError ? undefined : settings?.fee_type, settingsError ? undefined : settings?.fee_value);
  if ('error' in fee) throw new Error(fee.error);
  const { data: connection, error } = await db.from('payment_connections').select('provider,status,credentials_encrypted').eq('id', app.connection_id).eq('business_id', app.business_id).maybeSingle();
  if (error || !connection || connection.provider !== 'mercadopago' || connection.status !== 'active') throw new Error('not_connected');
  const credentials = JSON.parse(decryptSecret(connection.credentials_encrypted)) as { access_token?: string };
  const token = credentials.access_token?.trim();
  if (!token) throw new Error('not_connected');
  const expires = new Date(Date.now() + 15 * 60_000);
  const externalReference = randomUUID();
  const idempotencyKey = `${app.id}:${bookingId}`;
  const claim = await claimCharge({ client_app_id: app.id, booking_id: bookingId, external_reference: externalReference, amount, currency: 'ARS', expires_at: expires.toISOString(), idempotency_key: idempotencyKey, payer_ref: bookingId, return_url: null, fee_amount: fee.fee });
  if (!claim.created) {
    if (claim.charge.init_point) return { init_point: claim.charge.init_point, status: claim.charge.status === 'approved' ? 'approved' as never : 'pending' };
    throw new Error('charge_in_progress');
  }
  try {
    const payload = { items: [{ title: (app.item_title?.trim() || 'Seña').slice(0, 120), quantity: 1, currency_id: 'ARS', unit_price: amount }], payer: payerName ? { name: payerName } : undefined, external_reference: externalReference, notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago`, ...(fee.fee > 0 ? { marketplace_fee: fee.fee } : {}) };
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': idempotencyKey }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error('mp_preference_failed');
    const preference: unknown = await response.json();
    if (!preference || typeof preference !== 'object' || typeof (preference as { id?: unknown }).id !== 'string' || typeof (preference as { init_point?: unknown }).init_point !== 'string') throw new Error('invalid_preference');
    const p = preference as { id: string; init_point: string };
    await updateCreatingCharge(claim.charge.id, { preference_id: p.id, init_point: p.init_point });
    return { init_point: p.init_point, status: 'pending' };
  } catch (error) {
    await db.from('hub_charges').delete().eq('id', claim.charge.id).eq('status', 'creating');
    throw error;
  }
}
