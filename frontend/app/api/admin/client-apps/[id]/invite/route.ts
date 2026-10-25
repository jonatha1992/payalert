import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionProfile, getServiceClient } from '@/lib/server/session';
import { ScopeError } from '@/lib/server/scope';

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
    if (app.connection_id) throw new ScopeError('La app ya tiene una conexión asociada.', 400);
    const token = 'ci_' + randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error: inviteError } = await db.from('connect_invites').insert({ client_app_id: app.id, token_hash: tokenHash, expires_at: expiresAt });
    if (inviteError) {
      if (['42P01', 'PGRST205'].includes(inviteError.code ?? '') || /connect_invites|schema cache/i.test(inviteError.message ?? '')) {
        throw new ScopeError('No se pueden generar invitaciones: faltan las migraciones 021_connect_invites/022 en la base de datos.', 503);
      }
      throw inviteError;
    }
    const base = process.env.PAYALERT_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    return NextResponse.json({ url: new URL('/connect/' + encodeURIComponent(token), base).toString(), expires_at: expiresAt });
  } catch (error) {
    if (error instanceof ScopeError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[Admin client app invite] request failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'No pudimos generar el enlace de conexión.' }, { status: 500 });
  }
}
