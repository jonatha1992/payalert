import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/server/rbac';
import { ScopeError } from '@/lib/server/scope';
import { getSessionProfile, getServiceClient } from '@/lib/server/session';
import { WebhookQueue } from '@/lib/server/webhookQueue';
import { apiRateLimiter } from '@/lib/security/rateLimiter';
import { withRateLimit } from '@/lib/security/withRateLimit';
import { logStructured } from '@/lib/server/structuredLog';

async function handler(request: NextRequest) {
  try {
    const profile = await getSessionProfile(request);
    const authenticated = requirePermission(profile, 'configuration', 'read');
    if (authenticated.role !== 'owner') throw new ScopeError('Permiso insuficiente', 403);

    const metrics = await new WebhookQueue(getServiceClient()).metrics();
    return NextResponse.json(metrics);
  } catch (error) {
    if (error instanceof ScopeError) {
      logStructured('webhook_metrics_denied', { status: error.status });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logStructured('webhook_metrics_failed');
    return NextResponse.json({ error: 'metrics_unavailable' }, { status: 500 });
  }
}

export const GET = withRateLimit(handler, { limiter: apiRateLimiter });
