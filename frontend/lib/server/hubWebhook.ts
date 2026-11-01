import 'server-only';
import { getServiceClient } from '@/lib/server/session';
import type { NormalizedTransaction } from '@/lib/payments/types';
import type { ClientApp } from '@/lib/server/clientApps';
import { transitionCharge, hubChargeTransitions, type HubCharge } from '@/lib/server/hubCharges';

type HubPayment = Pick<NormalizedTransaction, 'externalReference' | 'externalId' | 'amount' | 'currency' | 'status'> & { occurredAt?: string };
type ChargeRow = HubCharge & { client_apps: ClientApp };
type Db = ReturnType<typeof getServiceClient>;

export async function applyHubPayment(payment: HubPayment, db: Db): Promise<void> {
  if (!payment.externalReference) return;
  const { data: charge, error } = await db.from('hub_charges').select('*,client_apps(*)')
    .eq('external_reference', payment.externalReference).maybeSingle<ChargeRow>();
  if (error) throw error;
  if (!charge) return;
  if (payment.amount !== charge.amount || payment.currency !== charge.currency) {
    const { error: updateError } = await db.from('hub_charges').update({
      last_error: 'payment_amount_or_currency_mismatch', updated_at: new Date().toISOString(),
    }).eq('id', charge.id);
    if (updateError) throw updateError;
    return;
  }
  if (charge.status !== 'pending' && charge.status !== 'expired') return;
  if (payment.status !== 'CONFIRMED' && payment.status !== 'REJECTED') return;

  const approved = payment.status === 'CONFIRMED';
  if (!approved && charge.status !== 'pending') return;
  const expired = charge.status === 'expired' || Date.parse(charge.expires_at) <= (payment.occurredAt && !Number.isNaN(Date.parse(payment.occurredAt)) ? Date.parse(payment.occurredAt) : Date.now());
  const nextStatus: HubCharge['status'] = approved ? (expired ? 'needs_refund' : 'approved') : 'rejected';
  if (!hubChargeTransitions[charge.status].includes(nextStatus)) return;
  const changed = await transitionCharge(charge.id, charge.status, nextStatus, { payment_id: payment.externalId, last_error: null });
  if (!changed) return;
}
