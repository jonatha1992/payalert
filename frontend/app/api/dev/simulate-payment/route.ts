import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getConnector } from '@/lib/payments/connectors';
import type { MockConnector } from '@/lib/payments/connectors/mock';
import type { MovementStatus } from '@/lib/payments/types';
import { requirePermission } from '@/lib/server/rbac';
import { resolveScope } from '@/lib/server/scope';
import { getServiceClient, getSessionProfile, scopeErrorResponse } from '@/lib/server/session';
import { processWebhook } from '@/lib/server/webhookHandler';

const STATUSES: MovementStatus[] = ['PENDING', 'CONFIRMED', 'REJECTED', 'REVERSED'];

/**
 * POST /api/dev/simulate-payment (PRD etapa 3: MockFinancialConnector)
 * body { amount, status?, externalId?, externalReference? }
 * Runs the real ingestion pipeline against the business's `mock` connection.
 * Reuse an externalId to simulate duplicates, reversals or late confirmations.
 * Disabled in production unless PAYMENTS_ENABLE_SIMULATOR=true.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production' && process.env.PAYMENTS_ENABLE_SIMULATOR !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const profile = requirePermission(await getSessionProfile(request), 'movement', 'create');
    const body = (await request.json()) as {
      businessId?: string;
      amount?: number;
      status?: MovementStatus;
      externalId?: string;
      externalReference?: string;
    };
    const { businessId } = resolveScope(profile, { businessId: body.businessId });
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Monto inválido' }, { status: 400 });
    }
    const status = STATUSES.includes(body.status as MovementStatus) ? (body.status as MovementStatus) : 'CONFIRMED';

    const { data: connection } = await getServiceClient()
      .from('payment_connections')
      .select('id')
      .eq('business_id', businessId)
      .eq('provider', 'mock')
      .neq('status', 'DISCONNECTED')
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (!connection) {
      return NextResponse.json({ error: 'Conectá primero el proveedor de prueba en Integraciones.' }, { status: 400 });
    }

    const externalId = body.externalId || `sim-${randomUUID()}`;
    (getConnector('mock') as MockConnector).seed({
      provider: 'mock',
      externalId,
      providerAccountId: null,
      direction: 'IN',
      amount,
      currency: 'ARS',
      status,
      occurredAt: new Date().toISOString(),
      payerName: null,
      payerIdentifier: null,
      description: 'Pago simulado',
      externalReference: body.externalReference ?? null,
      raw: { simulated: true },
    });

    const result = await processWebhook('mock', {
      headers: {},
      query: { connection: connection.id },
      rawBody: JSON.stringify({ externalId }),
    });
    return NextResponse.json({ externalId, ...result }, { status: 200 });
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    console.error('[Simulator] failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'La simulación falló.' }, { status: 500 });
  }
}
