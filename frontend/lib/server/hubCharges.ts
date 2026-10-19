import 'server-only';
import { getServiceClient } from '@/lib/server/session';

export type HubChargeStatus = 'creating' | 'pending' | 'approved' | 'refunding' | 'rejected' | 'expired' | 'refunded' | 'needs_refund';
export type HubCharge = { id: string; client_app_id: string; booking_id: string; external_reference: string; amount: number; currency: string; preference_id: string | null; init_point: string | null; payment_id: string | null; status: HubChargeStatus; expires_at: string; idempotency_key: string; firestore_synced: boolean; last_error: string | null };
type ChargeClaim = Omit<HubCharge, 'id'|'preference_id'|'init_point'|'payment_id'|'status'|'firestore_synced'|'last_error'>;
type TransitionStatus = Exclude<HubChargeStatus, 'creating'>;
const transitions: Record<HubChargeStatus, readonly HubChargeStatus[]> = { creating: ['pending'], pending: ['approved','rejected','expired','needs_refund'], approved: ['refunding'], refunding: ['approved','refunded'], rejected: [], expired: ['needs_refund'], needs_refund: [], refunded: [] };
export const hubChargeTransitions: Record<HubChargeStatus, readonly HubChargeStatus[]> = transitions;

export async function findCharge(appId: string, bookingId: string): Promise<HubCharge | null> {
  const { data, error } = await getServiceClient().from('hub_charges').select('*').eq('client_app_id', appId).eq('booking_id', bookingId).maybeSingle();
  if (error) throw error;
  return data as HubCharge | null;
}

export async function claimCharge(input: ChargeClaim): Promise<{ created: boolean; charge: HubCharge }> {
  const { data, error } = await getServiceClient().from('hub_charges').insert({ ...input, status: 'creating' }).select('*').maybeSingle();
  if (error) throw error;
  if (data) return { created: true, charge: data as HubCharge };
  const existing = await findCharge(input.client_app_id, input.booking_id);
  if (!existing) throw new Error('Conflicting charge claim was not visible');
  return { created: false, charge: existing };
}

export async function updateCreatingCharge(id: string, patch: Partial<HubCharge>): Promise<HubCharge> {
  const { data, error } = await getServiceClient().from('hub_charges').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'creating').select('*').single();
  if (error) throw error;
  return data as HubCharge;
}

export async function transitionCharge(id: string, from: HubChargeStatus, to: TransitionStatus, patch: Partial<HubCharge> = {}): Promise<HubCharge | null> {
  if (!hubChargeTransitions[from].includes(to)) throw new Error(`Invalid hub charge transition: ${from} -> ${to}`);
  const { data, error } = await getServiceClient().from('hub_charges').update({ ...patch, status: to, updated_at: new Date().toISOString() }).eq('id', id).eq('status', from).select('*').maybeSingle();
  if (error) throw error;
  return data as HubCharge | null;
}
