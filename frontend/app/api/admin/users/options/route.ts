import { NextRequest, NextResponse } from 'next/server';
import { getSessionProfile, getServiceClient } from '@/lib/server/session';
import { ScopeError } from '@/lib/server/scope';

export async function GET(request: NextRequest) {
  try {
    const profile = await getSessionProfile(request);
    if (!profile) throw new ScopeError('No autenticado', 401);
    if (profile.role !== 'admin') throw new ScopeError('Permiso insuficiente', 403);
    const { data, error } = await getServiceClient().from('stores').select('id,name,business_id').order('name');
    if (error) throw error;
    return NextResponse.json({ stores: data ?? [] });
  } catch (error) {
    if (error instanceof ScopeError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[Admin users] options failed');
    return NextResponse.json({ error: 'No pudimos cargar las sucursales.' }, { status: 500 });
  }
}
