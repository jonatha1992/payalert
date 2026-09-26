// Server-only module: web push delivery scoped to one business.
import webpush from 'web-push';
import { getServiceClient } from '@/lib/server/session';

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string }>;
}

export interface PushTarget {
  businessId: string;
  /** When set, only owners of the business and employees assigned to this store are notified. */
  storeId?: string | null;
  /** Optional narrowing to specific users; they must still belong to the business. */
  userIds?: string[];
}

let vapidConfigured = false;

function configureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:soporte@payalert.com', publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export async function sendPushToBusiness(
  target: PushTarget,
  notification: PushNotificationPayload,
): Promise<{ sent: number; failed: number; total: number }> {
  const supabase = getServiceClient();

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, role, assigned_store_id')
    .eq('business_id', target.businessId);
  if (usersError) throw usersError;

  let recipients = (users ?? []).filter(
    (u) => !target.storeId || u.role === 'owner' || u.assigned_store_id === target.storeId,
  );
  if (target.userIds) {
    const allowed = new Set(target.userIds);
    recipients = recipients.filter((u) => allowed.has(u.id));
  }
  // Never fall back to an unfiltered query: no recipients means nobody gets notified.
  if (recipients.length === 0) return { sent: 0, failed: 0, total: 0 };

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', recipients.map((u) => u.id));
  if (error) throw error;
  if (!subscriptions || subscriptions.length === 0) return { sent: 0, failed: 0, total: 0 };
  if (!configureVapid()) throw new Error('VAPID keys are not configured');

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(notification),
        );
        return true;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
        return false;
      }
    }),
  );

  const sent = results.filter((r) => r.status === 'fulfilled' && r.value).length;
  return { sent, failed: results.length - sent, total: results.length };
}
