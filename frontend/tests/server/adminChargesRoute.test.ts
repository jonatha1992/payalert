import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ profile: vi.fn(), rows: [] as Record<string, unknown>[] }));
vi.mock('@/lib/server/session', () => ({
  getSessionProfile: mocks.profile,
  getServiceClient: () => ({ from: () => ({
    select: () => ({ order: () => ({ limit: async () => ({ data: mocks.rows, error: null }) }) }),
  }) }),
  scopeErrorResponse: (error: unknown) => error instanceof Error && 'status' in error
    ? new Response(JSON.stringify({ error: error.message }), { status: Number(error.status) }) : null,
}));

import { GET } from '@/app/api/admin/charges/route';

describe('GET /api/admin/charges', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.rows = []; });
  it('returns 401 without a session', async () => {
    mocks.profile.mockResolvedValue(null);
    expect((await GET(new NextRequest('https://example.test/api/admin/charges'))).status).toBe(401);
  });
  it('returns 403 for non-owners', async () => {
    mocks.profile.mockResolvedValue({ userId: 'u', role: 'admin', businessId: 'b', assignedStoreId: null });
    expect((await GET(new NextRequest('https://example.test/api/admin/charges'))).status).toBe(403);
  });
  it('returns safe latest charge fields to an owner only', async () => {
    mocks.profile.mockResolvedValue({ userId: 'u', role: 'owner', businessId: 'b', assignedStoreId: null });
    mocks.rows = [{ amount: 4500, status: 'approved', created_at: '2026-01-01T00:00:00Z', client_apps: { slug: 'huellitas' }, payer_ref: 'secret-payer', booking_id: 'secret-booking', external_reference: 'secret-ref', payment_id: 'secret-payment', last_error: 'secret-error' }];
    const response = await GET(new NextRequest('https://example.test/api/admin/charges'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ charges: [{ amount: 4500, status: 'approved', created_at: '2026-01-01T00:00:00Z', app: 'huellitas' }] });
    expect(JSON.stringify(body)).not.toMatch(/secret-payer|secret-booking|secret-ref|secret-payment|secret-error/);
  });
});
