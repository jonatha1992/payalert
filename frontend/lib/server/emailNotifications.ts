import type { SupabaseClient } from '@supabase/supabase-js';
import type { Provider } from '@/lib/payments/types';
import { getCorreoCentralClient, type CorreoCentralClient } from '@/lib/server/correoCentral';
import { getServiceClient } from '@/lib/server/session';

export interface PaymentEmailTarget {
  businessId: string;
  storeId?: string | null;
}

export interface PaymentEmailNotification {
  transactionId: string;
  amount: number;
  currency: string;
  provider: Provider;
  occurredAt: string;
}

export interface EmailNotificationDeps {
  db?: SupabaseClient;
  client?: CorreoCentralClient;
  appUrl?: string;
}

interface UserEmailRow {
  id: string;
  email: string | null;
  role: string;
  assigned_store_id: string | null;
}

const PROVIDER_LABELS: Record<Provider, string> = {
  mercado_pago: 'Mercado Pago',
  uala: 'Ualá',
  mock: 'Simulador',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatAmount(amount: number, currency: string): string {
  const normalized = currency || 'ARS';
  const formatted = Number.isFinite(amount)
    ? amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(amount);
  return `${normalized} ${formatted}`;
}

function buildPaymentEmailContent(notification: PaymentEmailNotification, appUrl: string): {
  subject: string;
  text: string;
  html: string;
} {
  const amountLabel = formatAmount(notification.amount, notification.currency);
  const providerLabel = PROVIDER_LABELS[notification.provider] ?? notification.provider;
  const terminalUrl = `${appUrl.replace(/\/+$/, '')}/dashboard/terminal`;

  const subject = `Nuevo pago recibido: ${amountLabel}`;
  const text = [
    'Recibiste un nuevo pago en PayAlert.',
    `Monto: ${amountLabel}`,
    `Medio: ${providerLabel}`,
    `Ver en PayAlert: ${terminalUrl}`,
  ].join('\n');

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;margin:0 auto;background-color:#ffffff;border-radius:8px;border:1px solid #e4e4e7;">
      <tr>
        <td style="padding:24px;">
          <h1 style="margin:0 0 12px 0;font-size:20px;line-height:26px;color:#18181b;">Nuevo pago recibido</h1>
          <p style="margin:0 0 16px 0;font-size:15px;line-height:22px;color:#3f3f46;">Se acreditó un cobro en tu cuenta de PayAlert.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px 0;background-color:#f9fafb;border-radius:6px;">
            <tr>
              <td style="padding:12px 16px;font-size:14px;color:#52525b;">Monto</td>
              <td style="padding:12px 16px;font-size:15px;font-weight:bold;color:#18181b;text-align:right;">${escapeHtml(amountLabel)}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;font-size:14px;color:#52525b;border-top:1px solid #e4e4e7;">Medio</td>
              <td style="padding:12px 16px;font-size:14px;color:#18181b;text-align:right;border-top:1px solid #e4e4e7;">${escapeHtml(providerLabel)}</td>
            </tr>
          </table>
          <table role="presentation" cellspacing="0" cellpadding="0">
            <tr>
              <td style="border-radius:6px;background-color:#111827;">
                <a href="${escapeHtml(terminalUrl)}" style="display:inline-block;padding:12px 20px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">Ver cobros en PayAlert</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

async function resolveEmailRecipients(
  db: SupabaseClient,
  target: PaymentEmailTarget,
): Promise<Array<{ id: string; email: string }>> {
  const { data: users, error } = await db
    .from('users')
    .select('id, email, role, assigned_store_id')
    .eq('business_id', target.businessId);
  if (error) throw error;

  const scoped = ((users ?? []) as UserEmailRow[]).filter((user) =>
    Boolean(user.email && user.email.includes('@'))
    && (!target.storeId || user.role === 'owner' || user.assigned_store_id === target.storeId)
  );
  if (!scoped.length) return [];

  const { data: preferences, error: prefsError } = await db
    .from('user_notification_preferences')
    .select('user_id, email_enabled')
    .eq('business_id', target.businessId)
    .in('user_id', scoped.map((user) => user.id));
  if (prefsError) throw prefsError;

  const enabledIds = new Set(
    (preferences ?? [])
      .filter((row: { user_id: string; email_enabled: boolean }) => row.email_enabled === true)
      .map((row: { user_id: string }) => row.user_id)
  );

  return scoped
    .filter((user) => enabledIds.has(user.id))
    .map((user) => ({ id: user.id, email: user.email!.trim() }));
}

export async function sendPaymentEmailToBusiness(
  target: PaymentEmailTarget,
  notification: PaymentEmailNotification,
  deps: EmailNotificationDeps = {},
): Promise<{ sent: number; failed: number; total: number }> {
  const client = deps.client ?? getCorreoCentralClient();
  if (!client.isConfigured()) {
    return { sent: 0, failed: 0, total: 0 };
  }

  const db = deps.db ?? getServiceClient();
  const recipients = await resolveEmailRecipients(db, target);
  if (!recipients.length) {
    return { sent: 0, failed: 0, total: 0 };
  }

  const appUrl = deps.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://payalert.tecnofusion.dev';
  const content = buildPaymentEmailContent(notification, appUrl);

  const outcomes = await Promise.allSettled(
    recipients.map((recipient) =>
      client.send({
        to: recipient.email,
        subject: content.subject,
        text: content.text,
        html: content.html,
        idempotencyKey: `payment-${notification.transactionId}-${recipient.id}`.slice(0, 128),
      })
    )
  );

  const sent = outcomes.filter((item) => item.status === 'fulfilled' && item.value.ok).length;
  return { sent, failed: recipients.length - sent, total: recipients.length };
}
