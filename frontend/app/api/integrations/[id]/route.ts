import { NextRequest, NextResponse } from 'next/server';
import { disconnectConnection } from '@/lib/server/connections';
import { requirePermission } from '@/lib/server/rbac';
import { resolveScope } from '@/lib/server/scope';
import { getSessionProfile, scopeErrorResponse } from '@/lib/server/session';

// DELETE /api/integrations/:id - desconectar y destruir credenciales
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const profile = requirePermission(await getSessionProfile(request), 'connection', 'delete');
    const { businessId } = resolveScope(profile, { businessId: request.nextUrl.searchParams.get('businessId') });
    const { id } = await context.params;
    await disconnectConnection(businessId, profile.userId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    console.error('[Integrations] delete failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'No pudimos desconectar la integración.' }, { status: 500 });
  }
}
