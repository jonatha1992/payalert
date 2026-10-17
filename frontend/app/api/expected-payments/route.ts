import { NextRequest, NextResponse } from 'next/server';
import { listExpectedPayments, createExpectedPayment, type CreateExpectedPaymentInput } from '@/lib/server/expectedPayments';
import { requirePermission } from '@/lib/server/rbac';
import { resolveScope } from '@/lib/server/scope';
import { assertStoreInBusiness, getSessionProfile, scopeErrorResponse } from '@/lib/server/session';
import { validateBody } from '@/lib/server/validateBody';
import { validationSchemas } from '@/lib/validation/schemas';
import { withRateLimit } from '@/lib/security/withRateLimit';
import { apiRateLimiter } from '@/lib/security/rateLimiter';
import { getClientIP } from '@/lib/security/withRateLimit';


async function listExpectedPaymentsHandler(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const profile = requirePermission(await getSessionProfile(request), 'charge', 'read');
    const scope = resolveScope(profile, {
      businessId: params.get('businessId'),
      storeId: params.get('storeId'),
    });
    await assertStoreInBusiness(scope.storeId, scope.businessId);
    return NextResponse.json({ expectedPayments: await listExpectedPayments(scope, params.get('status')) });
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    console.error('[ExpectedPayments] list failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'No pudimos cargar los cobros.' }, { status: 500 });
  }
}

async function createExpectedPaymentHandler(request: NextRequest) {
  try {
    const profile = requirePermission(await getSessionProfile(request), 'charge', 'create');
    const parsed = await validateBody<CreateExpectedPaymentInput & { storeId?: string }>(request, validationSchemas.expectedCharge);
    if (!parsed.ok) return parsed.response;
    const body = parsed.value;
    const scope = resolveScope(profile, { storeId: body.storeId });
    await assertStoreInBusiness(scope.storeId, scope.businessId);
    const created = await createExpectedPayment(scope, profile.userId, body, { origin: request.nextUrl.origin });
    return NextResponse.json({ expectedPayment: created }, { status: 201 });
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    console.error('[ExpectedPayments] create failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'No pudimos crear el cobro.' }, { status: 500 });
  }
}

export const GET = withRateLimit(listExpectedPaymentsHandler, { limiter: apiRateLimiter, key: (request) => `api:expected-payments:${getClientIP(request)}` });
export const POST = withRateLimit(createExpectedPaymentHandler, { limiter: apiRateLimiter, key: (request) => `api:expected-payments:${getClientIP(request)}` });
