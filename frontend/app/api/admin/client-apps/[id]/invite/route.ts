import { NextRequest, NextResponse } from 'next/server';
import { getSessionProfile, getServiceClient } from '@/lib/server/session';
import { ScopeError } from '@/lib/server/scope';
import { ConnectInviteError, createConnectInvite } from '@/lib/server/connectInvites';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const profile = await getSessionProfile(request);
    if (!profile) throw new ScopeError('No autenticado', 401);
    if (profile.role !== 'admin') throw new ScopeError('Permiso insuficiente', 403);
    const { id } = await context.params;
    const db = getServiceClient();
    const { data: app, error: appError } = await db.from('client_apps').select('id,slug,active,connection_id').eq('id', id).maybeSingle();
    if (appError) throw appError;
    if (!app) throw new ScopeError('App vinculada no encontrada.', 404);
    if (!app.active) throw new ScopeError('La app está inactiva; activala antes de generar un enlace.', 400);
    if (typeof app.connection_id === 'string' && app.connection_id.length > 0) throw new ScopeError('La app ya tiene una conexión asociada.', 400);
    return NextResponse.json(await createConnectInvite(app.id, request.url));
  } catch (error) {
    if (error instanceof ScopeError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ConnectInviteError) return NextResponse.json({ error: error.message }, { status: 503 });
    console.error('[Admin client app invite] request failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'No pudimos generar el enlace de conexión.' }, { status: 500 });
  }
}
