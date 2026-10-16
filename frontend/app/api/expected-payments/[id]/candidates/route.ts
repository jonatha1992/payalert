import { NextRequest, NextResponse } from 'next/server';
import { dismissExpectedPaymentCandidate } from '@/lib/server/expectedPayments';
import { requirePermission } from '@/lib/server/rbac';
import { resolveScope } from '@/lib/server/scope';
import { getSessionProfile, scopeErrorResponse } from '@/lib/server/session';
import { withRateLimit } from '@/lib/security/withRateLimit';
import { apiRateLimiter } from '@/lib/security/rateLimiter';

type Context = { params: Promise<{ id: string }> };

async function dismissHandler(request: NextRequest, context: Context) {
  try {
    const profile = requirePermission(await getSessionProfile(request), 'charge', 'resolve');
    const scope = resolveScope(profile, { businessId: request.nextUrl.searchParams.get('businessId') });
    const { id } = await context.params;
    const { transactionId } = (await request.json()) as { transactionId?: string };
    if (!transactionId) return NextResponse.json({ error: 'transactionId es requerido' }, { status: 400 });
    await dismissExpectedPaymentCandidate(scope, profile.userId, id, transactionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    console.error('[ExpectedPayments] dismiss candidate failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'No pudimos descartar el candidato.' }, { status: 500 });
  }
}

export const DELETE = withRateLimit(dismissHandler, { limiter: apiRateLimiter });
