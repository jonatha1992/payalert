// Server-only module: web push delivery scoped to one business.
import webpush from 'web-push';
import { getServiceClient } from '@/lib/server/session';
import { logStructured } from '@/lib/server/structuredLog';

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

interface Recipient { id: string; role: string; assigned_store_id: string | null }
interface ExpoTicket { status?: string; details?: { error?: string }; id?: string }
interface ExpoResponse { data?: ExpoTicket[] }

async function resolveRecipients(target: PushTarget): Promise<Recipient[]> {
  const db = getServiceClient();
  const { data: users, error } = await db.from('users').select('id, role, assigned_store_id').eq('business_id', target.businessId);
  if (error) throw error;
  const allowedIds = target.userIds ? new Set(target.userIds) : null;
  const recipients = (users ?? []).filter((user) => (!target.storeId || user.role === 'owner' || user.assigned_store_id === target.storeId)
    && (!allowedIds || allowedIds.has(user.id)));
  if (!recipients.length) return [];
  const { data: preferences, error: prefsError } = await db.from('user_notification_preferences')
    .select('user_id, push_enabled').eq('business_id', target.businessId).in('user_id', recipients.map((user) => user.id));
  if (prefsError) throw prefsError;
  const prefs = new Map((preferences ?? []).map((row) => [row.user_id, row.push_enabled]));
  return recipients.filter((user) => prefs.get(user.id) !== false);
}

async function sendWebPush(userIds: string[], notification: PushNotificationPayload) {
  const db = getServiceClient();
  const { data: subscriptions, error } = await db.from('push_subscriptions').select('endpoint, p256dh, auth').in('user_id', userIds);
  if (error) throw error;
  if (!subscriptions?.length) return { sent: 0, failed: 0, total: 0 };
  if (!configureVapid()) throw new Error('VAPID keys are not configured');
  const results = await Promise.allSettled(subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(notification));
      return true;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      logStructured('push_web_delivery_failed', { statusCode: typeof status === 'number' ? status : null });
      if (status === 404 || status === 410) {
        const { error: cleanupError } = await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        if (cleanupError) logStructured('push_web_cleanup_failed');
      }
      return false;
    }
  }));
  const sent = results.filter((result) => result.status === 'fulfilled' && result.value).length;
  return { sent, failed: results.length - sent, total: results.length };
}

async function sendExpoPush(userIds: string[], businessId: string, notification: PushNotificationPayload) {
  const db = getServiceClient();
  const { data: tokens, error } = await db.from('device_push_tokens').select('id, expo_push_token').eq('business_id', businessId)
    .is('revoked_at', null).in('user_id', userIds);
  if (error) throw error;
  if (!tokens?.length) return { sent: 0, failed: 0, total: 0 };
  let sent = 0, failed = 0;
  for (let offset = 0; offset < tokens.length; offset += 100) {
    const batch = tokens.slice(offset, offset + 100);
    const messages = batch.map((token) => ({ to: token.expo_push_token, title: notification.title, body: notification.body,
      sound: 'default', data: notification.data ?? {} }));
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(messages),
    });
    if (!response.ok) { failed += batch.length; logStructured('expo_push_batch_failed', { status: response.status, count: batch.length }); continue; }
    const payload = await response.json() as ExpoResponse;
    for (const [index, token] of batch.entries()) {
      const ticket = payload.data?.[index];
      if (ticket?.status === 'ok') { sent += 1; continue; }
      failed += 1;
      if (ticket?.details?.error === 'DeviceNotRegistered') {
        const { error: revokeError } = await db.from('device_push_tokens').update({ revoked_at: new Date().toISOString() })
          .eq('id', token.id).eq('business_id', businessId);
        if (revokeError) logStructured('expo_push_revoke_failed');
      }
    }
  }
  return { sent, failed, total: tokens.length };
}

export async function sendPushToBusiness(target: PushTarget, notification: PushNotificationPayload): Promise<{ sent: number; failed: number; total: number }> {
  const recipients = await resolveRecipients(target);
  if (!recipients.length) return { sent: 0, failed: 0, total: 0 };
  const userIds = recipients.map((recipient) => recipient.id);
  const [web, expo] = await Promise.all([sendWebPush(userIds, notification), sendExpoPush(userIds, target.businessId, notification)]);
  return { sent: web.sent + expo.sent, failed: web.failed + expo.failed, total: web.total + expo.total };
}
