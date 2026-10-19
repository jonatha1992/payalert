import { createHash, createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
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
    const { error } = await db.from('transactions').upsert({
      id, business_id: scope.businessId, store_id: scope.storeId, type: 'income', category: 'Ventas',
      amount: hint.amount, currency: 'ARS', description: hint.payerName ? `Aviso de transferencia de ${hint.payerName}` : 'Aviso de transferencia sin confirmar',
      status: 'pending', provider_status: 'PENDING', provider: 'mercado_pago', external_id: id,
      occurred_at: parsed.value.postedAt, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      metadata: { source: 'device_notification', notification_key_hash: createHash('sha256').update(parsed.value.notificationKey).digest('hex'), confirmed: false },
    }, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw error;
    stage = 'push';
    await sendPushToBusiness({ businessId: scope.businessId, storeId: scope.storeId }, {
      title: 'Aviso de transferencia', body: `Aviso: posible transferencia de $${hint.amount.toLocaleString('es-AR')} (sin confirmar)`, data: { transactionId: id },
    });
    logStructured('mobile_payment_hint_accepted', { businessId: scope.businessId, transactionId: id });
    return NextResponse.json({ accepted: true, transactionId: id }, { status: 200 });
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    logFailure(error, stage);
    return NextResponse.json({ error: 'No pudimos procesar el aviso.' }, { status: 500 });
  }
}, { limiter: webhookRateLimiter, key: (request) => {
  const auth = request.headers.get('authorization') ?? 'anonymous';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'payment-hint-rate-limit';
  return `payment-hint:${createHmac('sha256', key).update(auth).digest('hex')}:${request.nextUrl.pathname}`;
} });
