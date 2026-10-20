import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:soporte@payalert.com';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Configurar web-push
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey
  );
}

interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: Array<{
    action: string;
    title: string;
  }>;
}

// POST /api/push/send - Enviar notificación push
export async function POST(request: NextRequest) {
  try {
    const { 
      userId, 
      businessId, 
      notification 
    }: { 
      userId?: string; 
      businessId?: string; 
      notification: PushNotificationPayload 
    } = await request.json();

    if (!notification || !notification.title) {
      return NextResponse.json(
        { error: 'Notificación inválida' },
        { status: 400 }
      );
    }

    // Construir query base
    let query = supabase
      .from('push_subscriptions')
      .select('*');

    // Filtrar por usuario o negocio
    if (userId) {
      query = query.eq('user_id', userId);
    } else if (businessId) {
      // Obtener todos los usuarios del negocio
      const { data: users } = await supabase
        .from('users')
        .select('id')
        .eq('business_id', businessId);
      
      if (users && users.length > 0) {
        query = query.in('user_id', users.map(u => u.id));
      }
    }

    const { data: subscriptions, error } = await query;

    if (error) {
      console.error('[Push Send] Error fetching subscriptions:', error);
      return NextResponse.json(
        { error: 'Error al obtener suscripciones' },
        { status: 500 }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json(
        { message: 'No hay suscripciones activas' },
        { status: 200 }
      );
    }

    // Enviar notificaciones
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            JSON.stringify(notification)
          );
          return { success: true, endpoint: sub.endpoint };
        } catch (error) {
          // Si falla con 410 o 404, la suscripción ya no es válida
          if (error instanceof Error && 
              (error.message.includes('410') || error.message.includes('404'))) {
            // Eliminar suscripción inválida
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', sub.endpoint);
          }
          return { success: false, endpoint: sub.endpoint, error: error instanceof Error ? error.message : 'Error desconocido' };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && (r.value as { success: boolean }).success).length;
    const failed = results.length - successful;

    return NextResponse.json({
      success: true,
      sent: successful,
      failed,
      total: subscriptions.length,
    }, { status: 200 });

  } catch (error) {
    console.error('[Push Send] Error:', error);
    return NextResponse.json(
      { error: 'Error interno' },
      { status: 500 }
    );
  }
}
