import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  profile: vi.fn(),
  metrics: vi.fn(),
  log: vi.fn(),
  check: vi.fn(async () => ({ allowed: true, remaining: 20, retryAfter: 60 })),
}));

vi.mock('@/lib/server/session', () => ({ getSessionProfile: mocks.profile, getServiceClient: vi.fn(() => ({})) }));
vi.mock('@/lib/server/webhookQueue', () => ({ WebhookQueue: class { metrics = mocks.metrics; } }));
vi.mock('@/lib/security/rateLimiter', () => ({ apiRateLimiter: { check: mocks.check } }));
vi.mock('@/lib/server/structuredLog', () => ({ logStructured: mocks.log }));

import { GET } from '@/app/api/internal/webhook-metrics/route';

describe('GET /api/internal/webhook-metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.check.mockResolvedValue({ allowed: true, remaining: 20, retryAfter: 60 });
    mocks.metrics.mockResolvedValue({ pending: 3, dead: 1, oldestPendingAgeSeconds: 92 });
  });

  it('returns 401 without a session', async () => {
    mocks.profile.mockResolvedValue(null);
    const response = await GET(new NextRequest('https://example.test/api/internal/webhook-metrics'), {});
    expect(response.status).toBe(401);
    expect(mocks.metrics).not.toHaveBeenCalled();
  });

  it('returns 403 unless the session role is owner', async () => {
    mocks.profile.mockResolvedValue({ userId: 'u1', role: 'admin', businessId: 'b1', assignedStoreId: null });
    const response = await GET(new NextRequest('https://example.test/api/internal/webhook-metrics'), {});
    expect(response.status).toBe(403);
    expect(mocks.metrics).not.toHaveBeenCalled();
  });

  it('returns only aggregate metrics, never queue payloads or secrets', async () => {
    mocks.profile.mockResolvedValue({ userId: 'u1', role: 'owner', businessId: 'b1', assignedStoreId: null });
    const response = await GET(new NextRequest('https://example.test/api/internal/webhook-metrics'), {});
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ pending: 3, dead: 1, oldestPendingAgeSeconds: 92 });
    expect(mocks.check).toHaveBeenCalledOnce();
  });
});
