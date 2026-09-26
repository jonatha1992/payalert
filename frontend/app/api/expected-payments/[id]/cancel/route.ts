import { NextRequest, NextResponse } from 'next/server';
import { updateExpectedPayment } from '@/lib/server/expectedPayments';
import { resolveScope } from '@/lib/server/scope';
import { getSessionProfile, scopeErrorResponse } from '@/lib/server/session';

// POST /api/expected-payments/:id/cancel
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const profile = await getSessionProfile(request);
    const scope = resolveScope(profile, { businessId: request.nextUrl.searchParams.get('businessId') });
    const { id } = await context.params;
    return NextResponse.json({ expectedPayment: await updateExpectedPayment(scope, profile!.userId, id, { type: 'cancel' }) });
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    console.error('[ExpectedPayments] cancel failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'No pudimos cancelar el cobro.' }, { status: 500 });
  }
}
