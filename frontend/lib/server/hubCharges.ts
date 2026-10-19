import 'server-only';
import { getServiceClient } from '@/lib/server/session';
export type HubCharge = { id: string; client_app_id: string; booking_id: string; external_reference: string; amount: number; currency: string; preference_id: string | null; payment_id: string | null; status: string; expires_at: string; idempotency_key: string; firestore_synced: boolean; last_error: string | null };
const allowed = new Set(['pending', 'approved', 'rejected', 'expired', 'refunded', 'needs_refund']);
export async function findCharge(appId: string, bookingId: string): Promise<HubCharge | null> {
 const { data, error } = await getServiceClient().from('hub_charges').select('*').eq('client_app_id', appId).eq('booking_id', bookingId).maybeSingle();
 if (error) throw error; return data as HubCharge | null;
}
export async function createCharge(input: Omit<HubCharge, 'id'|'payment_id'|'status'|'firestore_synced'|'last_error'>): Promise<HubCharge> {
 const { data, error } = await getServiceClient().from('hub_charges').upsert({...input,status:'pending'},{onConflict:'client_app_id,booking_id',ignoreDuplicates:true}).select('*').maybeSingle();
 if (error) throw error; if (data) return data as HubCharge;
 const old = await findCharge(input.client_app_id,input.booking_id); if (!old) throw new Error('Idempotent insert was not visible'); return old;
}
export async function transitionCharge(id: string, status: string, patch: Partial<HubCharge> = {}): Promise<HubCharge> {
 if (!allowed.has(status)) throw new Error('Invalid hub charge status'); const db=getServiceClient();
 const {data: current,error:readError}=await db.from('hub_charges').select('*').eq('id',id).single(); if(readError) throw readError;
 const rank:Record<string,number>={pending:0,rejected:1,expired:1,approved:2,needs_refund:3,refunded:4};
 if(rank[status]<rank[current.status]) return current as HubCharge;
 const {data,error}=await db.from('hub_charges').update({...patch,status,updated_at:new Date().toISOString()}).eq('id',id).select('*').single(); if(error) throw error; return data as HubCharge;
}
