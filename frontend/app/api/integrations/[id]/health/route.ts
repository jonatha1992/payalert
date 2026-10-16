import { NextRequest, NextResponse } from 'next/server';
import { checkConnectionHealth } from '@/lib/server/connections';
import { requirePermission } from '@/lib/server/rbac';
import { resolveScope } from '@/lib/server/scope';
import { getSessionProfile, scopeErrorResponse } from '@/lib/server/session';

// GET /api/integrations/[id]/health - Verificar salud de una conexión
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const profile = requirePermission(await getSessionProfile(request), 'connection', 'read');
    const { businessId } = resolveScope(profile, {
      businessId: request.nextUrl.searchParams.get('businessId'),
    });
    const { id } = await context.params;

    const result = await checkConnectionHealth(businessId, id);

    return NextResponse.json({ ok: result.ok, status: result.status, detail: result.detail, lastSyncAt: result.lastSyncAt });
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    console.error('[Integrations Health] failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ ok: false, detail: 'health_check_failed' }, { status: 500 });
  }
}