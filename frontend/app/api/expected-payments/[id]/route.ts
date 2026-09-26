import { NextRequest, NextResponse } from 'next/server';
import { getExpectedPayment, updateExpectedPayment } from '@/lib/server/expectedPayments';
import { resolveScope } from '@/lib/server/scope';
import { getSessionProfile, scopeErrorResponse } from '@/lib/server/session';

type Context = { params: Promise<{ id: string }> };

// GET /api/expected-payments/:id - estado de un cobro (la terminal lo consulta mientras espera)
export async function GET(request: NextRequest, context: Context) {
  try {
    const scope = resolveScope(await getSessionProfile(request), {
      businessId: request.nextUrl.searchParams.get('businessId'),
    });
    const { id } = await context.params;
    return NextResponse.json({ expectedPayment: await getExpectedPayment(scope, id) });
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    console.error('[ExpectedPayments] get failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'No pudimos cargar el cobro.' }, { status: 500 });
  }
}

// PATCH /api/expected-payments/:id  body { transactionId } - resolución manual (match auditado)
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const profile = await getSessionProfile(request);
    const scope = resolveScope(profile, { businessId: request.nextUrl.searchParams.get('businessId') });
    const { id } = await context.params;
    const { transactionId } = (await request.json()) as { transactionId?: string };
    if (!transactionId) return NextResponse.json({ error: 'transactionId es requerido' }, { status: 400 });
    const updated = await updateExpectedPayment(scope, profile!.userId, id, { type: 'match', transactionId });
    return NextResponse.json({ expectedPayment: updated });
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    console.error('[ExpectedPayments] match failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'No pudimos actualizar el cobro.' }, { status: 500 });
  }
}
