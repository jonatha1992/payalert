import type { NormalizedTransaction } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

export interface HintCandidate { id: string; amount: number; occurredAt: string; status: string }
export interface ConfirmedCandidate { id: string; amount: number; occurredAt: string; status: string; paymentTypeId: string | null }

export function deterministicHintId(businessId: string, notificationKey: string): string {
  const digest = createHash('sha256').update(`${businessId}\0${notificationKey}`).digest('hex');
  return `hint_${digest}`;
}

export function findHintReconciliation(hints: HintCandidate[], payment: ConfirmedCandidate): HintCandidate | null {
  if (payment.status !== 'CONFIRMED' || payment.paymentTypeId !== 'bank_transfer' || !Number.isFinite(payment.amount)) return null;
  const paymentTime = Date.parse(payment.occurredAt);
  if (!Number.isFinite(paymentTime)) return null;
  const matches = hints.filter((hint) => hint.status === 'PENDING' && hint.amount === payment.amount
    && Math.abs(Date.parse(hint.occurredAt) - paymentTime) <= 10 * 60_000);
  return matches.length === 1 ? matches[0] : null;
}

export async function reconcileDeviceNotificationHint(db: SupabaseClient, businessId: string, transaction: NormalizedTransaction): Promise<void> {
  if (transaction.provider !== 'mercado_pago' || transaction.status !== 'CONFIRMED'
    || transaction.raw.payment_type_id !== 'bank_transfer') return;
  const occurredAt = Date.parse(transaction.occurredAt);
  if (!Number.isFinite(occurredAt)) return;
  const { data, error } = await db.from('transactions')
    .select('id, amount, occurred_at, provider_status')
    .eq('business_id', businessId).eq('provider', 'mercado_pago')
    .eq('provider_status', 'PENDING').eq('metadata->>source', 'device_notification')
    .eq('amount', transaction.amount)
    .gte('occurred_at', new Date(occurredAt - 10 * 60_000).toISOString())
    .lte('occurred_at', new Date(occurredAt + 10 * 60_000).toISOString());
  if (error) throw error;
  const hint = findHintReconciliation((data ?? []).map((row) => ({ id: row.id, amount: Number(row.amount),
    occurredAt: row.occurred_at, status: row.provider_status ?? 'UNKNOWN' })), {
    id: transaction.externalId, amount: transaction.amount, occurredAt: transaction.occurredAt,
    status: transaction.status, paymentTypeId: String(transaction.raw.payment_type_id),
  });
  if (!hint) return;
  const { error: updateError } = await db.from('transactions').update({
    provider_status: 'CONFIRMED', status: 'completed', provider: 'mercado_pago', external_id: transaction.externalId,
    metadata: { ...transaction.raw, external_reference: transaction.externalReference, source: 'device_notification',
      reconciled_by_external_id: transaction.externalId }, updated_at: new Date().toISOString(),
  }).eq('id', hint.id).eq('business_id', businessId).eq('provider_status', 'PENDING')
    .eq('metadata->>source', 'device_notification').select('id');
  if (updateError) throw updateError;
}
