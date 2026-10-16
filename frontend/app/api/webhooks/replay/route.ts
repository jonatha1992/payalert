import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/scope';
import { recordAuditEvent } from '@/lib/server/audit';
import { WebhookQueue } from '@/lib/server/webhookQueue';
import { getServiceClient, getSessionProfile, scopeErrorResponse } from '@/lib/server/session';

export async function POST(request: NextRequest) {
  try {
    const profile = requireRole(await getSessionProfile(request), ['owner']);
    const body: unknown = await request.json();
    const id = body && typeof body === 'object' && 'id' in body && typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ error: 'invalid_event_id' }, { status: 400 });
    const db = getServiceClient();
    const { data, error } = await db.from('webhook_events').select('id, connection_id, payment_connections!inner(business_id)')
      .eq('id', id).eq('status', 'DEAD').maybeSingle<{ id: string; connection_id: string; payment_connections: { business_id: string } }>();
    if (error) throw error;
    if (!data || data.payment_connections.business_id !== profile.businessId) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    const requeued = await new WebhookQueue(db).requeueDead(id);
    if (!requeued) return NextResponse.json({ error: 'not_replayable' }, { status: 409 });
    await recordAuditEvent(db, { businessId: profile.businessId, actorId: profile.userId, action: 'CONFIGURATION_UPDATED',
      entityType: 'webhook_event', entityId: id, newData: { action: 'replay' } });
    return NextResponse.json({ replayed: true });
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    return NextResponse.json({ error: 'replay_failed' }, { status: 500 });
  }
}
