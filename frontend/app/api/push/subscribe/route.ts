import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/server/rbac';
import { getServiceClient, getSessionProfile } from '@/lib/server/session';

// POST /api/push/subscribe - Guardar suscripción de push
export async function POST(request: NextRequest) {
  try {
    const profile = requirePermission(await getSessionProfile(request), 'push', 'create');
    const { subscription } = await request.json();
    const supabase = getServiceClient();

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: 'Suscripción inválida' },
        { status: 400 }
      );
    }

    // Guardar suscripción en la base de datos
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        endpoint: subscription.endpoint,
        p256dh: subscription.keys?.p256dh,
        auth: subscription.keys?.auth,
        user_id: profile.userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'endpoint',
      });

    if (error) {
      console.error('[Push Subscribe] Error:', error);
      return NextResponse.json(
        { error: 'Error al guardar suscripción' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[Push Subscribe] Error:', error);
    return NextResponse.json(
      { error: 'Error interno' },
      { status: 500 }
    );
  }
}
