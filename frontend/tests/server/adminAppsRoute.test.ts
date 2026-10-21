import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ profile: vi.fn(), rows: [] as Record<string, unknown>[] }));
vi.mock('@/lib/server/session', () => ({
  getSessionProfile: mocks.profile,
  getServiceClient: () => ({ from: () => ({
    select: () => ({ order: async () => ({ data: mocks.rows, error: null }) }),
  }) }),
  scopeErrorResponse: (error: unknown) => error instanceof Error && 'status' in error
    ? new Response(JSON.stringify({ error: error.message }), { status: Number(error.status) }) : null,
}));

import { GET } from '@/app/api/admin/apps/route';

describe('GET /api/admin/apps', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.rows = []; });
  it('returns 401 without a session', async () => {
    mocks.profile.mockResolvedValue(null);
    expect((await GET(new NextRequest('https://example.test/api/admin/apps'))).status).toBe(401);
  });
  it('returns 403 for non-owners', async () => {
    mocks.profile.mockResolvedValue({ userId: 'u', role: 'employee', businessId: 'b', assignedStoreId: 's' });
    expect((await GET(new NextRequest('https://example.test/api/admin/apps'))).status).toBe(403);
  });
  it('returns safe app and account details to an owner only', async () => {
    mocks.profile.mockResolvedValue({ userId: 'u', role: 'owner', businessId: 'b', assignedStoreId: null });
    mocks.rows = [{ slug: 'huellitas', active: true, allowed_origins: ['https://app.example'], deposit_default: 5000, connect_return_url: 'https://app.example/return', connection_id: 'conn1', payment_connections: { provider: 'mercado_pago', provider_account_id: '12345', status: 'CONNECTED', credentials_encrypted: 'secret-credentials', webhook_secret_encrypted: 'secret-webhook' }, api_key_hash: 'secret-api-hash', firebase_sa_encrypted: 'secret-service-account' }];
    const response = await GET(new NextRequest('https://example.test/api/admin/apps'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ apps: [{ slug: 'huellitas', active: true, allowed_origins: ['https://app.example'], deposit_default: 5000, connect_return_url: 'https://app.example/return', connected: true, account: { provider: 'mercado_pago', provider_account_id: '12345' } }] });
    expect(JSON.stringify(body)).not.toMatch(/secret-credentials|secret-webhook|secret-api-hash|secret-service-account/);
  });
});
