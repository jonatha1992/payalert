import { NextRequest, NextResponse } from 'next/server';
import { getSessionProfile, getServiceClient, scopeErrorResponse } from '@/lib/server/session';
import { ScopeError } from '@/lib/server/scope';
import { recordAuditEvent } from '@/lib/server/audit';
import { createClientAppConnectLink } from '@/lib/server/clientAppConnectLinks';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const profile = await getSessionProfile(request);
    if (!profile) throw new ScopeError('No autenticado', 401);
    if (profile.role !== 'admin') throw new ScopeError('Permiso insuficiente', 403);
    const { id } = await context.params;
    const db = getServiceClient();
    const { data: app, error } = await db.from('client_apps').select('id,business_id').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!app) throw new ScopeError('App vinculada no encontrada.', 400);
    const link = await createClientAppConnectLink(id, 7 * 24 * 60 * 60 * 1000);
    await recordAuditEvent(db, { businessId: app.business_id, actorId: profile.userId, action: 'CONFIGURATION_UPDATED', entityType: 'client_app_connect_link', entityId: id });
    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    console.error('admin_client_app_connect_link_failed', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'No pudimos generar el enlace de conexión.' }, { status: 500 });
  }
}
