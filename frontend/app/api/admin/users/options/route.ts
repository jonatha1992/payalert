import { NextRequest, NextResponse } from 'next/server';
import { getSessionProfile, getServiceClient } from '@/lib/server/session';
import { ScopeError } from '@/lib/server/scope';

export async function GET(request: NextRequest) {
  try {
    const profile = await getSessionProfile(request);
    if (!profile) throw new ScopeError('No autenticado', 401);
    if (profile.role !== 'admin') throw new ScopeError('Permiso insuficiente', 403);
    const db = getServiceClient();
    const [stores, businesses] = await Promise.all([db.from('stores').select('id,name,business_id').order('name'), db.from('businesses').select('id,name').order('name')]);
    if (stores.error) throw stores.error;
    if (businesses.error) throw businesses.error;
    return NextResponse.json({ stores: stores.data ?? [], businesses: businesses.data ?? [] });
  } catch (error) {
    if (error instanceof ScopeError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[Admin users] options failed');
    return NextResponse.json({ error: 'No pudimos cargar las sucursales.' }, { status: 500 });
  }
}
