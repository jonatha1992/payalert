import { NextRequest, NextResponse } from 'next/server';
import { getExpectedPayment, updateExpectedPayment } from '@/lib/server/expectedPayments';
import { requirePermission } from '@/lib/server/rbac';
import { resolveScope } from '@/lib/server/scope';
import { getSessionProfile, scopeErrorResponse } from '@/lib/server/session';
import { withRateLimit } from '@/lib/security/withRateLimit';
import { apiRateLimiter } from '@/lib/security/rateLimiter';

type Context = { params: Promise<{ id: string }> };

async function getExpectedPaymentHandler(request: NextRequest, context: Context) {
  try {
    const profile = requirePermission(await getSessionProfile(request), 'charge', 'read');
    const scope = resolveScope(profile, { businessId: request.nextUrl.searchParams.get('businessId') });
    const { id } = await context.params;
    return NextResponse.json({ expectedPayment: await getExpectedPayment(scope, id) });
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    console.error('[ExpectedPayments] get failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'No pudimos cargar el cobro.' }, { status: 500 });
  }
}

async function updateExpectedPaymentHandler(request: NextRequest, context: Context) {
  try {
    const profile = requirePermission(await getSessionProfile(request), 'charge', 'resolve');
    const scope = resolveScope(profile, { businessId: request.nextUrl.searchParams.get('businessId') });
    const { id } = await context.params;
    const { transactionId } = (await request.json()) as { transactionId?: string };
    if (!transactionId) return NextResponse.json({ error: 'transactionId es requerido' }, { status: 400 });
    const updated = await updateExpectedPayment(scope, profile.userId, id, { type: 'match', transactionId });
    return NextResponse.json({ expectedPayment: updated });
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    console.error('[ExpectedPayments] match failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'No pudimos actualizar el cobro.' }, { status: 500 });
  }
}

export const GET = withRateLimit(getExpectedPaymentHandler, { limiter: apiRateLimiter });
export const PATCH = withRateLimit(updateExpectedPaymentHandler, { limiter: apiRateLimiter });
