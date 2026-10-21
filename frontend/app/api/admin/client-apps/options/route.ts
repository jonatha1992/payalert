import { NextRequest, NextResponse } from 'next/server';
import { getSessionProfile, getServiceClient } from '@/lib/server/session';
import { ScopeError } from '@/lib/server/scope';

export async function GET(request: NextRequest) {
  try {
    const profile = await getSessionProfile(request);
    if (!profile) throw new ScopeError('No autenticado', 401);
    if (profile.role !== 'admin') throw new ScopeError('Permiso insuficiente', 403);
    const db = getServiceClient();
    if (request.nextUrl.searchParams.get('connections') === '1') {
      const { data, error } = await db.from('payment_connections').select('id, business_id, provider, status, label').neq('status', 'DISCONNECTED').order('created_at', { ascending: false });
      if (error) throw error;
      return NextResponse.json({ connections: data ?? [] });
    }
    const { data, error } = await db.from('businesses').select('id, name').order('name');
    if (error) throw error;
    return NextResponse.json({ businesses: data ?? [] });
  } catch (error) {
    if (error instanceof ScopeError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[Admin client app options] load failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'No pudimos cargar las opciones.' }, { status: 500 });
  }
}
