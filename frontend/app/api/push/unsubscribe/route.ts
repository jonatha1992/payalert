import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient, getSessionProfile } from '@/lib/server/session';

// POST /api/push/unsubscribe - Eliminar suscripción de push
export async function POST(request: NextRequest) {
  try {
    const profile = await getSessionProfile(request);
    if (!profile) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const { endpoint } = await request.json();
    const supabase = getServiceClient();

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Endpoint requerido' },
        { status: 400 }
      );
    }

    // Eliminar suscripción de la base de datos
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .eq('user_id', profile.userId);

    if (error) {
      console.error('[Push Unsubscribe] Error:', error);
      return NextResponse.json(
        { error: 'Error al eliminar suscripción' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[Push Unsubscribe] Error:', error);
    return NextResponse.json(
      { error: 'Error interno' },
      { status: 500 }
    );
  }
}
