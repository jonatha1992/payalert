import 'server-only';
import { getServiceClient } from '@/lib/server/session';
import { firebaseForClientApp } from '@/lib/server/firebaseAdmin';
import type { NormalizedTransaction } from '@/lib/payments/types';
import type { ClientApp } from '@/lib/server/clientApps';
import type { HubCharge } from '@/lib/server/hubCharges';

type HubPayment = Pick<NormalizedTransaction, 'externalReference' | 'externalId' | 'amount' | 'currency' | 'status'>;
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
  if (charge.status !== 'pending') return;
  if (payment.status !== 'CONFIRMED' && payment.status !== 'REJECTED') return;

  const approved = payment.status === 'CONFIRMED';
  const expired = Date.parse(charge.expires_at) <= Date.now();
  const nextStatus = approved ? (expired ? 'needs_refund' : 'approved') : 'rejected';
  const { data: updated, error: transitionError } = await db.from('hub_charges')
    .update({ status: nextStatus, payment_id: payment.externalId, firestore_synced: false,
      last_error: null, updated_at: new Date().toISOString() })
    .eq('id', charge.id).eq('status', 'pending').select('id').maybeSingle();
  if (transitionError) throw transitionError;
  if (!updated) return;
  if (nextStatus === 'needs_refund') {
    const { error: refundSyncError } = await db.from('hub_charges')
      .update({ firestore_synced: true, updated_at: new Date().toISOString() }).eq('id', charge.id);
    if (refundSyncError) throw refundSyncError;
    return;
  }

  try {
    const { firestore } = firebaseForClientApp(charge.client_apps);
    const bookingRef = firestore.collection('bookings').doc(charge.booking_id);
    const booking = await bookingRef.get();
    if (!booking.exists) throw new Error('booking_missing');
    const current = booking.data()!;
    if (approved && current.status !== 'pendiente') {
      throw new Error('booking_not_pending');
    }
    await bookingRef.update({
      ...(approved ? { status: 'confirmada' } : {}),
      'pago.estado': approved ? 'aprobado' : 'rechazado',
      'pago.paymentId': payment.externalId,
    });
    const { error: syncedError } = await db.from('hub_charges')
      .update({ firestore_synced: true, last_error: null, updated_at: new Date().toISOString() }).eq('id', charge.id);
    if (syncedError) throw syncedError;
  } catch (error) {
    const { error: updateError } = await db.from('hub_charges').update({
      firestore_synced: false, last_error: error instanceof Error ? error.name : 'firestore_sync_failed',
      updated_at: new Date().toISOString(),
    }).eq('id', charge.id);
    if (updateError) throw updateError;
  }
}
