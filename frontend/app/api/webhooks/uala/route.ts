import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { handleProviderWebhook } from '@/lib/server/webhookHandler';
import { withRateLimit } from '@/lib/security/withRateLimit';
import { webhookRateLimiter } from '@/lib/security/rateLimiter';

// Ualá Bis v2 order notifications (unsigned). Tenant: the order uuid must belong to an expected payment we created. See docs/providers/uala.md.
// Amount and status always come from the provider API, never from the webhook body.
async function ualaWebhookHandler(request: NextRequest) {
  try {
    return await handleProviderWebhook('uala', request);
  } catch (error) {
    console.error('[Webhook uala] Error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ received: false }, { status: 500 });
  }
}

export const POST = withRateLimit(ualaWebhookHandler, {
  limiter: webhookRateLimiter,
  getIdentifier: (req) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
});

export async function GET() {
  return NextResponse.json({ message: 'Webhook endpoint is active', provider: 'uala', version: '3.0' });
}
