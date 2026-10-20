import { createHash, createHmac } from 'node:crypto';
import { after, NextRequest, NextResponse } from 'next/server';
import { getConnector } from '@/lib/payments/connectors';
import { ingestWebhook } from '@/lib/payments/ingest';
import { connectorForSyncedTransaction } from '@/lib/payments/syncConnector';
import { syncConnectionPayments } from '@/lib/payments/manualSync';
import { ensureFreshCredentials } from '@/lib/payments/tokenRefresh';
import { refreshAccessToken } from '@/lib/payments/connectors/mercadopagoOAuth';
import { encryptSecret } from '@/lib/payments/secretBox';
import { CONNECTION_COLUMNS, SupabasePaymentsRepository, toConnection, type ConnectionRow } from '@/lib/server/paymentsRepository';
import type { NormalizedTransaction, WebhookRequest } from '@/lib/payments/types';
import { parsePaymentNotification } from '@/lib/payments/notificationParser';
import { deterministicHintId } from '@/lib/payments/notificationHintReconciliation';
import { requiredText, type Validator } from '@/lib/validation/rules';
import type { Schema } from '@/lib/validation/schemas';
import { validateBody } from '@/lib/server/validateBody';
import { requirePermission } from '@/lib/server/rbac';
import { resolveScope } from '@/lib/server/scope';
import { getServiceClient, getSessionProfile, scopeErrorResponse } from '@/lib/server/session';
import { sendPushToBusiness } from '@/lib/server/push';
import { logStructured } from '@/lib/server/structuredLog';
import { webhookRateLimiter } from '@/lib/security/rateLimiter';
import { withRateLimit } from '@/lib/security/withRateLimit';

const packageNames = new Set(['com.mercadopago.wallet']);
const SYNC_RETRY_DELAYS_MS = [0, 5_000, 5_000, 5_000] as const;
const businessSyncs = new Map<string, Promise<void>>();
const confirmedPushes = new Set<string>();
const isoTimestamp: Validator<string> = (input) => {
  const parsed = requiredText(1, 40)(input);
  if (!parsed.ok || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(parsed.value)
    || !Number.isFinite(Date.parse(parsed.value))) return { ok: false, fields: { value: 'Ingresá una fecha ISO válida.' } };
  return parsed;
};
const hintSchema: Schema = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, fields: { form: 'Ingresá datos válidos.' } };
  const source = input as Record<string, unknown>;
  const fields: Record<string, string> = {};
  const value: Record<string, string> = {};
  for (const [key, validator] of Object.entries({ packageName: requiredText(1, 120), title: requiredText(1, 200), text: requiredText(1, 2000), postedAt: isoTimestamp, notificationKey: requiredText(1, 512) })) {
    const result = validator(source[key]);
    if (!result.ok) fields[key] = result.fields.value ?? 'Valor inválido.';
    else value[key] = result.value;
  }
  return Object.keys(fields).length ? { ok: false, fields } : { ok: true, value };
};

function logFailure(error: unknown, stage: string): void {
  logStructured('mobile_payment_hint_failed', {
    stage,
    errorName: error instanceof Error ? error.name : 'UnknownError',
    errorMessage: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
    errorHash: createHash('sha256').update(error instanceof Error ? error.stack ?? error.message : String(error)).digest('hex').slice(0, 16),
  });
}

async function syncBusiness(businessId: string, storeId: string | null, hintId: string): Promise<void> {
  const existing = businessSyncs.get(businessId);
  if (existing) {
    logStructured('mobile_payment_hint_sync_attempt', { businessId, hintId, attempt: 0, outcome: 'coalesced' });
    return existing;
  }
  const task = synchronizeHint(businessId, storeId, hintId);
  businessSyncs.set(businessId, task);
  try { await task; } finally { businessSyncs.delete(businessId); }
}

async function synchronizeHint(businessId: string, storeId: string | null, hintId: string): Promise<void> {
  const db = getServiceClient();
  const oauth = process.env.MP_CLIENT_ID && process.env.MP_CLIENT_SECRET && process.env.MP_OAUTH_REDIRECT_URI
    ? { clientId: process.env.MP_CLIENT_ID, clientSecret: process.env.MP_CLIENT_SECRET, redirectUri: process.env.MP_OAUTH_REDIRECT_URI }
    : null;
  for (let attempt = 0; attempt < SYNC_RETRY_DELAYS_MS.length; attempt += 1) {
    if (SYNC_RETRY_DELAYS_MS[attempt]) await new Promise(resolve => setTimeout(resolve, SYNC_RETRY_DELAYS_MS[attempt]));
    try {
      const { data: rows, error } = await db.from('payment_connections').select(`${CONNECTION_COLUMNS}, last_sync_at`)
        .eq('business_id', businessId).eq('provider', 'mercado_pago').in('status', ['CONNECTED', 'DEGRADED']);
      if (error) throw error;
      const connections = (rows ?? []).map(row => toConnection(row as ConnectionRow));
      if (!connections.length) {
        logStructured('mobile_payment_hint_sync_attempt', { businessId, hintId, attempt: attempt + 1, outcome: 'no_active_connection' });
        return;
      }
      const repo = new SupabasePaymentsRepository(db);
      for (const raw of connections) {
        const connection = oauth ? await ensureFreshCredentials(raw, {
          refresh: token => refreshAccessToken(token, oauth),
          persist: async (selected, credentials) => {
            const { error: updateError } = await db.from('payment_connections').update({ credentials_encrypted: encryptSecret(JSON.stringify(credentials)), status: 'CONNECTED', last_error: null })
              .eq('id', selected.id).eq('business_id', businessId);
            if (updateError) throw updateError;
          },
          markReauthRequired: async selected => {
            const { error: updateError } = await db.from('payment_connections').update({ status: 'REAUTH_REQUIRED', last_error: 'oauth_refresh_failed', updated_at: new Date().toISOString() })
              .eq('id', selected.id).eq('business_id', businessId);
            if (updateError) throw updateError;
          },
        }) : raw;
        const connector = getConnector(connection.provider);
        if (!connector.listRecentTransactions) throw new Error('sync_not_supported');
        const result = await syncConnectionPayments(connection, {
          listTransactions: selected => connector.listRecentTransactions!(selected),
          ingest: async (selected, transaction: NormalizedTransaction) => {
            const request: WebhookRequest = { rawBody: '', headers: {}, query: { connection: selected.id } };
            const response = await ingestWebhook({ provider: selected.provider, request, repo, connectorFactory: () => connectorForSyncedTransaction(connector, transaction) });
            return response.outcome === 'processed' ? 'processed' : response.outcome === 'duplicate' ? 'duplicate' : 'failed';
          },
          recordFreshness: async (selected, timestamp) => {
            const { error: updateError } = await db.from('payment_connections').update({ last_sync_at: timestamp, last_sync_source: 'mobile_payment_hint', updated_at: timestamp })
              .eq('id', selected.id).eq('business_id', businessId);
            if (updateError) throw updateError;
          },
          audit: async () => undefined,
          log: fields => logStructured('mobile_payment_hint_provider_sync', fields),
        });
        const { data: hint, error: hintError } = await db.from('transactions').select('provider_status, amount')
          .eq('id', hintId).eq('business_id', businessId).maybeSingle<{ provider_status: string; amount: number }>();
        if (hintError) throw hintError;
        const confirmed = hint?.provider_status === 'CONFIRMED';
        logStructured('mobile_payment_hint_sync_attempt', { businessId, hintId, attempt: attempt + 1, connectionId: connection.id, checked: result.checked, outcome: confirmed ? 'confirmed' : 'not_found' });
        if (confirmed && !confirmedPushes.has(hintId)) {
          confirmedPushes.add(hintId);
          try {
            await sendPushToBusiness({ businessId, storeId }, { title: 'Transferencia confirmada', body: `Llegó la transferencia de $${Number(hint.amount).toLocaleString('es-AR')} (confirmada)`, data: { transactionId: hintId } });
          } catch (error) {
            confirmedPushes.delete(hintId);
            throw error;
          }
        }
        if (confirmed) return;
      }
    } catch (error) {
      logFailure(error, `sync_attempt_${attempt + 1}`);
      logStructured('mobile_payment_hint_sync_attempt', { businessId, hintId, attempt: attempt + 1, outcome: 'error', errorName: error instanceof Error ? error.name : 'UnknownError', errorMessage: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300) });
    }
  }
}

export const maxDuration = 60;
export const POST = withRateLimit(async (request: NextRequest) => {
  let stage = 'auth';
  try {
    const profile = requirePermission(await getSessionProfile(request), 'movement', 'create');
    const scope = resolveScope(profile, {});
    stage = 'rate_limit';
    const limit = await webhookRateLimiter.check(`payment-hint:${scope.businessId}:${scope.userId}`);
    if (!limit.allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } });
    stage = 'validate';
    const parsed = await validateBody<{ packageName: string; title: string; text: string; postedAt: string; notificationKey: string }>(request, hintSchema);
    if (!parsed.ok) return parsed.response;
    if (!packageNames.has(parsed.value.packageName)) return NextResponse.json({ error: 'package_not_allowed' }, { status: 400 });
    const hint = parsePaymentNotification(parsed.value.title, parsed.value.text);
    if (!hint) return NextResponse.json({ accepted: false }, { status: 200 });
    stage = 'persist';
    const id = deterministicHintId(scope.businessId, parsed.value.notificationKey);
    const db = getServiceClient();
    const { error } = await db.from('transactions').upsert({ id, business_id: scope.businessId, store_id: scope.storeId, type: 'income', category: 'Ventas', amount: hint.amount, currency: 'ARS', description: hint.payerName ? `Aviso de transferencia de ${hint.payerName}` : 'Aviso de transferencia sin confirmar', status: 'pending', provider_status: 'PENDING', provider: 'mercado_pago', external_id: id, occurred_at: parsed.value.postedAt, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), metadata: { source: 'device_notification', notification_key_hash: createHash('sha256').update(parsed.value.notificationKey).digest('hex'), confirmed: false } }, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw error;
    stage = 'push';
    await sendPushToBusiness({ businessId: scope.businessId, storeId: scope.storeId }, { title: 'Aviso de transferencia', body: `Aviso: posible transferencia de $${hint.amount.toLocaleString('es-AR')} (sin confirmar)`, data: { transactionId: id } });
    after(() => syncBusiness(scope.businessId, scope.storeId, id));
    logStructured('mobile_payment_hint_accepted', { businessId: scope.businessId, transactionId: id });
    return NextResponse.json({ accepted: true, transactionId: id }, { status: 200 });
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    logFailure(error, stage);
    return NextResponse.json({ error: 'No pudimos procesar el aviso.' }, { status: 500 });
  }
}, { limiter: webhookRateLimiter, key: request => {
  const auth = request.headers.get('authorization') ?? 'anonymous';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'payment-hint-rate-limit';
  return `payment-hint:${createHmac('sha256', key).update(auth).digest('hex')}:${request.nextUrl.pathname}`;
} });
