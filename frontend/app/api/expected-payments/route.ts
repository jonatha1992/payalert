import { NextRequest, NextResponse } from 'next/server';
import {
  createExpectedPayment,
  listExpectedPayments,
  type CreateExpectedPaymentInput,
} from '@/lib/server/expectedPayments';
import { resolveScope } from '@/lib/server/scope';
import { assertStoreInBusiness, getSessionProfile, scopeErrorResponse } from '@/lib/server/session';

// GET /api/expected-payments - cobros esperados del negocio o de la tienda del empleado
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const scope = resolveScope(await getSessionProfile(request), {
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

// POST /api/expected-payments - crear un cobro esperado (opcionalmente con link de pago del proveedor)
export async function POST(request: NextRequest) {
  try {
    const profile = await getSessionProfile(request);
    const body = (await request.json()) as CreateExpectedPaymentInput & { businessId?: string; storeId?: string };
    const scope = resolveScope(profile, { businessId: body.businessId, storeId: body.storeId });
    await assertStoreInBusiness(scope.storeId, scope.businessId);
    const created = await createExpectedPayment(scope, profile!.userId, body, { origin: request.nextUrl.origin });
    return NextResponse.json({ expectedPayment: created }, { status: 201 });
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    console.error('[ExpectedPayments] create failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'No pudimos crear el cobro.' }, { status: 500 });
  }
}
