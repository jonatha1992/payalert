// Server-only module: imported exclusively from app/api route handlers.
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { ScopeError, type SessionProfile } from '@/lib/server/scope';
import { requireKnownRole } from '@/lib/server/rbac';

let serviceClient: SupabaseClient | null = null;

/** Service-role client. Bypasses RLS: every query MUST filter by a server-resolved business. */
export function getServiceClient(): SupabaseClient {
  if (!serviceClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase service credentials are not configured');
    serviceClient = createClient(url, key, { auth: { persistSession: false } });
  }
  return serviceClient;
}

/** Reads the Supabase session from the request cookies and loads the caller's profile. */
export async function getSessionProfile(request: NextRequest): Promise<SessionProfile | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      // Route handlers only read the session; token refresh happens in proxy.ts.
      setAll: () => {},
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: row } = await getServiceClient()
    .from('users')
    .select('id, role, business_id, assigned_store_id')
    .eq('id', user.id)
    .maybeSingle();
  if (!row) return null;

  return {
    userId: row.id as string,
    role: requireKnownRole(row.role),
    businessId: (row.business_id as string | null) ?? null,
    assignedStoreId: (row.assigned_store_id as string | null) ?? null,
  };
}

/** Confirms a store id belongs to the business before using it in a service-role query. */
export async function assertStoreInBusiness(storeId: string | null, businessId: string): Promise<void> {
  if (!storeId) return;
  const { data } = await getServiceClient()
    .from('stores')
    .select('id')
    .eq('id', storeId)
    .eq('business_id', businessId)
    .maybeSingle();
  if (!data) throw new ScopeError('Acceso denegado a esta tienda', 403);
}

export function scopeErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof ScopeError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}
