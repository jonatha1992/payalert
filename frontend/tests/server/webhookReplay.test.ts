import { describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ profile: vi.fn(), requeueDead: vi.fn(), audit: vi.fn(), query: vi.fn(), status: 'DEAD' as string }));
vi.mock('@/lib/server/session', () => ({ getSessionProfile: mocks.profile, scopeErrorResponse: (error: unknown) => { const e = error as { status?: number; message?: string }; return e.status ? Response.json({ error: e.message }, { status: e.status }) : null; }, getServiceClient: () => ({
  from: () => { let status: string | undefined; const query = { select: () => query, eq: (key: string, value: string) => { if (key === 'status') mocks.status = value; return query; }, maybeSingle: () => mocks.status === 'DEAD' ? mocks.query() : Promise.resolve({ data: null, error: null }) }; return query; },
}) }));
vi.mock('@/lib/server/webhookQueue', () => ({ WebhookQueue: vi.fn(() => ({ requeueDead: mocks.requeueDead })) }));
vi.mock('@/lib/server/audit', () => ({ recordAuditEvent: mocks.audit }));
import { POST } from '@/app/api/webhooks/replay/route';

function request() { return { json: async () => ({ id: 'evt' }) } as unknown as NextRequest; }

describe('owner replay API', () => {
  it('requeues and audits a dead event belonging to the owner tenant', async () => {
    mocks.requeueDead.mockClear(); mocks.audit.mockClear();
    mocks.status = 'DEAD';
    mocks.profile.mockResolvedValue({ userId: 'owner', role: 'owner', businessId: 'biz-a', assignedStoreId: null });
    mocks.query.mockResolvedValue({ data: { id: 'evt', connection_id: 'conn', payment_connections: { business_id: 'biz-a' } }, error: null });
    mocks.requeueDead.mockResolvedValue(true);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.requeueDead).toHaveBeenCalledWith('evt');
    expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ businessId: 'biz-a', actorId: 'owner', entityId: 'evt' }));
  });
  it('denies cross-tenant replay without requeueing', async () => {
    mocks.requeueDead.mockClear(); mocks.audit.mockClear();
    mocks.status = 'DEAD';
    mocks.profile.mockResolvedValue({ userId: 'owner', role: 'owner', businessId: 'biz-a', assignedStoreId: null });
    mocks.query.mockResolvedValue({ data: { id: 'evt', connection_id: 'conn', payment_connections: { business_id: 'biz-b' } }, error: null });
    const response = await POST(request());
    expect(response.status).toBe(404);
    expect(mocks.requeueDead).not.toHaveBeenCalled();
  });
  it('rejects non-owner callers', async () => {
    mocks.requeueDead.mockClear(); mocks.audit.mockClear();
    mocks.status = 'DEAD';
    mocks.profile.mockResolvedValue({ userId: 'employee', role: 'employee', businessId: 'biz-a', assignedStoreId: 'store' });
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(mocks.requeueDead).not.toHaveBeenCalled();
  });
});
