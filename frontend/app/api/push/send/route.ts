import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/server/rbac';
import { resolveScope } from '@/lib/server/scope';
import { getSessionProfile, scopeErrorResponse } from '@/lib/server/session';
import { sendPushToBusiness, type PushNotificationPayload } from '@/lib/server/push';

// POST /api/push/send - Enviar notificación push (solo dueños/admin, dentro de su negocio)
export async function POST(request: NextRequest) {
  try {
    const profile = requirePermission(await getSessionProfile(request), 'push', 'create');
    const {
      userId,
      businessId,
      storeId,
      notification,
    }: {
      userId?: string;
      businessId?: string;
      storeId?: string;
      notification: PushNotificationPayload;
    } = await request.json();

    if (!notification || !notification.title) {
      return NextResponse.json({ error: 'Notificación inválida' }, { status: 400 });
    }

    const scope = resolveScope(profile, { businessId, storeId });
    const result = await sendPushToBusiness(
      { businessId: scope.businessId, storeId: scope.storeId, userIds: userId ? [userId] : undefined },
      notification,
    );

    if (result.total === 0) {
      return NextResponse.json({ message: 'No hay suscripciones activas' }, { status: 200 });
    }
    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    console.error('[Push Send] Error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
