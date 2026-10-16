import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

let serviceClient: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (!serviceClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase service credentials are not configured');
    serviceClient = createClient(url, key, { auth: { persistSession: false } });
  }
  return serviceClient;
}

export function isEmailAllowedForSignup(email: string, allowlist = process.env.ALLOWED_SIGNUP_EMAILS): boolean {
  const allowed = (allowlist ?? '').split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean);
  return allowed.length === 0 || allowed.includes(email.trim().toLowerCase());
}

function safeBusinessName(user: User): string {
  const metadata = user.user_metadata ?? {};
  const name = typeof metadata.full_name === 'string' ? metadata.full_name : typeof metadata.name === 'string' ? metadata.name : '';
  const fallback = user.email?.split('@')[0] ?? 'Nuevo negocio';
  return `${(name.trim() || fallback).slice(0, 100)} - Negocio`;
}

/** Provision the first owner. On user-id conflicts, the existing profile/business remain untouched. */
export async function bootstrapOwner(db: SupabaseClient, user: User): Promise<{ created: boolean }> {
  if (!user.email || !isEmailAllowedForSignup(user.email)) throw new Error('signup_not_allowed');
  const { data: existing, error: lookupError } = await db.from('users').select('id').eq('id', user.id).maybeSingle();
  if (lookupError) throw new Error('owner_profile_lookup_failed');
  if (existing) return { created: false };

  const { data: business, error: businessError } = await db.from('businesses').insert({ name: safeBusinessName(user), settings: {} }).select('id').single();
  if (businessError || !business) throw new Error('owner_business_create_failed');

  const { error: userError } = await db.from('users').upsert({
    id: user.id, business_id: business.id, email: user.email, role: 'owner',
    first_name: typeof user.user_metadata?.given_name === 'string' ? user.user_metadata.given_name : null,
    last_name: typeof user.user_metadata?.family_name === 'string' ? user.user_metadata.family_name : null,
  }, { onConflict: 'id', ignoreDuplicates: true });
  if (userError) {
    const { error: cleanupError } = await db.from('businesses').delete().eq('id', business.id);
    if (cleanupError) throw new Error('owner_profile_create_and_cleanup_failed');
    throw new Error('owner_profile_create_failed');
  }

  const { data: linked, error: verifyError } = await db.from('users').select('business_id').eq('id', user.id).maybeSingle();
  if (verifyError || !linked) {
    const { error: cleanupError } = await db.from('businesses').delete().eq('id', business.id);
    if (cleanupError) throw new Error('owner_profile_verify_and_cleanup_failed');
    throw new Error('owner_profile_create_failed');
  }
  if (linked.business_id !== business.id) {
    const { error: cleanupError } = await db.from('businesses').delete().eq('id', business.id);
    if (cleanupError) throw new Error('owner_business_cleanup_failed');
    return { created: false };
  }
  return { created: true };
}
