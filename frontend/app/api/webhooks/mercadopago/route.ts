import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { handleProviderWebhook } from '@/lib/server/webhookHandler';
import { withRateLimit } from '@/lib/security/withRateLimit';
import { webhookRateLimiter } from '@/lib/security/rateLimiter';

// Mercado Pago payment notifications. Tenant: payment_connections.provider_account_id = body.user_id; x-signature required. See docs/providers/mercadopago.md.
// Amount and status always come from the provider API, never from the webhook body.
async function mercadoPagoWebhookHandler(request: NextRequest) {
  try {
    return await handleProviderWebhook('mercado_pago', request);
  } catch (error) {
    console.error('[Webhook mercado_pago] Error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ received: false }, { status: 500 });
  }
}

export const POST = withRateLimit(mercadoPagoWebhookHandler, {
  limiter: webhookRateLimiter,
  getIdentifier: (req) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
});

export async function GET() {
  return NextResponse.json({ message: 'Webhook endpoint is active', provider: 'mercado_pago', version: '3.0' });
}
