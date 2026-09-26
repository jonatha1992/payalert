import { NextRequest, NextResponse } from 'next/server';
import { createConnection, listConnections, type CreateConnectionInput } from '@/lib/server/connections';
import { requireRole, resolveScope } from '@/lib/server/scope';
import { getSessionProfile, scopeErrorResponse } from '@/lib/server/session';

// GET /api/integrations - integraciones del negocio (sin credenciales)
export async function GET(request: NextRequest) {
  try {
    const profile = requireRole(await getSessionProfile(request), ['owner', 'admin']);
    const { businessId } = resolveScope(profile, { businessId: request.nextUrl.searchParams.get('businessId') });
    return NextResponse.json({ connections: await listConnections(businessId) });
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    console.error('[Integrations] list failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'No pudimos cargar las integraciones.' }, { status: 500 });
  }
}

// POST /api/integrations - conectar una cuenta (credenciales cifradas en el servidor)
export async function POST(request: NextRequest) {
  try {
    const profile = requireRole(await getSessionProfile(request), ['owner', 'admin']);
    const body = (await request.json()) as CreateConnectionInput & { businessId?: string };
    const { businessId } = resolveScope(profile, { businessId: body.businessId });
    const connection = await createConnection(businessId, profile.userId, body);
    return NextResponse.json({ connection }, { status: 201 });
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    console.error('[Integrations] create failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'No pudimos guardar la integración.' }, { status: 500 });
  }
}
