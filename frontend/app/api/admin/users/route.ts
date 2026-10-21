import { NextRequest, NextResponse } from 'next/server';
import { getSessionProfile, getServiceClient } from '@/lib/server/session';
import { ScopeError } from '@/lib/server/scope';

function authorize(profile: Awaited<ReturnType<typeof getSessionProfile>>) {
  if (!profile) throw new ScopeError('No autenticado', 401);
  if (profile.role !== 'admin') throw new ScopeError('Permiso insuficiente', 403);
}

export async function GET(request: NextRequest) {
  try {
    authorize(await getSessionProfile(request));
    const { data, error } = await getServiceClient().from('users').select('id,email,first_name,last_name,role,business_id,assigned_store_id,created_at,businesses(name),stores(name)').order('created_at', { ascending: false }).limit(500);
    if (error) throw error;
    return NextResponse.json({ users: data ?? [] });
  } catch (error) {
    if (error instanceof ScopeError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[Admin users] list failed');
    return NextResponse.json({ error: 'No pudimos cargar los usuarios.' }, { status: 500 });
  }
}
