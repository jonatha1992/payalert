import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { handleProviderWebhook } from '@/lib/server/webhookHandler';

// Mercado Pago payment notifications. Tenant: payment_connections.provider_account_id = body.user_id; x-signature required. See docs/providers/mercadopago.md.
// Amount and status always come from the provider API, never from the webhook body.
export async function POST(request: NextRequest) {
  try {
    return await handleProviderWebhook('mercado_pago', request);
  } catch (error) {
    console.error('[Webhook mercado_pago] Error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ received: false }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Webhook endpoint is active', provider: 'mercado_pago', version: '3.0' });
}
