import type { ClientApp } from '@/lib/server/clientApps';
import { decryptSecret } from '@/lib/payments/secretBox';
import { transitionCharge, type HubCharge } from '@/lib/server/hubCharges';

type RefundDb = { from: (table: string) => any };
type RefundCharge = HubCharge & { client_apps: ClientApp };
type RefundResult = 'approved' | 'rejected' | 'uncertain';

async function requestRefund(row: RefundCharge, db: RefundDb): Promise<RefundResult> {
  if (!row.payment_id) throw new Error('refund_payment_missing');
  if (!row.client_apps.connection_id) throw new Error('connection_unavailable');
  const { data: connection, error } = await db.from('payment_connections').select('credentials_encrypted')
    .eq('id', row.client_apps.connection_id).eq('business_id', row.client_apps.business_id).single();
  if (error) throw error;
  const credentials = JSON.parse(decryptSecret(connection.credentials_encrypted)) as { access_token: string };
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(row.payment_id)}/refunds`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${credentials.access_token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': `refund:${row.client_apps.id}:${row.booking_id}` },
    body: JSON.stringify({ amount: row.amount }),
  });
  let result: { status?: unknown };
  try { result = await response.json() as { status?: unknown }; }
  catch { return response.status >= 400 && response.status < 500 ? 'rejected' : 'uncertain'; }
  if (response.status >= 400 && response.status < 500) return 'rejected';
  return response.ok && result.status === 'approved' ? 'approved' : 'uncertain';
}

export async function completeRefund(row: RefundCharge, db: RefundDb): Promise<RefundResult> {
  const result = await requestRefund(row, db);
  if (result === 'rejected') {
    await transitionCharge(row.id, 'refunding', 'approved', { last_error: 'refund_rejected' });
    return result;
  }
  if (result === 'uncertain') return result;

  const completed = await transitionCharge(row.id, 'refunding', 'refunded', { last_error: null });
  if (!completed) throw new Error('refund_charge_transition_lost');
  return result;
}

export async function deleteStaleCreatingClaims(db: RefundDb): Promise<number> {
  const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data, error } = await db.from('hub_charges').delete().eq('status', 'creating').lt('created_at', cutoff).select('id');
  if (error) throw error;
  return data?.length ?? 0;
}

export async function reconcileStaleRefund(db: RefundDb, row: RefundCharge): Promise<boolean> {
  return (await completeRefund(row, db)) !== 'uncertain';
}
