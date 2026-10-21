import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { authorizationUrl, createOAuthState, digestOAuthState, newOAuthNonce, oauthConfig } from '@/lib/payments/connectors/mercadopagoOAuth';
import { getClientIP, withRateLimit } from '@/lib/security/withRateLimit';
import { authRateLimiter } from '@/lib/security/rateLimiter';
import { getServiceClient } from '@/lib/server/session';

type RouteContext = { params: Promise<{ token: string }> };
const INVALID_INVITE_HTML = '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Enlace no disponible</title><body><main><h1>Enlace no disponible</h1><p>Este enlace venció o ya se usó. Pedí uno nuevo a quien te lo envió.</p></main></body></html>';

async function startInvite(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { token } = await context.params;
  if (!token || token.length > 256) return invalidInvite();
  const config = oauthConfig();
  if (!config || !process.env.MP_OAUTH_STATE_SECRET) return NextResponse.json({ error: 'OAuth de Mercado Pago no está disponible.' }, { status: 503 });
  try {
    const db = getServiceClient();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const now = new Date().toISOString();
    const { data: invite, error } = await db.from('connect_invites').select('id,client_app_id,expires_at,used_at,client_apps!inner(id,business_id,active)').eq('token_hash', tokenHash).maybeSingle();
    if (error) throw error;
    const joinedApp = invite?.client_apps;
    const app = Array.isArray(joinedApp) ? joinedApp[0] as { id: string; business_id: string; active: boolean } | undefined : joinedApp as { id: string; business_id: string; active: boolean } | null | undefined;
    if (!invite || invite.used_at || invite.expires_at <= now || !app?.active || app.id !== invite.client_app_id) return invalidInvite();
    const nonce = newOAuthNonce();
    const state = createOAuthState({ tenantId: app.business_id, userId: `invite:${invite.id}`, nonce, issuedAt: Math.floor(Date.now() / 1000) });
    const { error: insertError } = await db.from('mp_oauth_states').insert({ state_hash: digestOAuthState(state), business_id: app.business_id, user_id: null, invite_id: invite.id, nonce_hash: digestOAuthState(nonce), expires_at: new Date(Date.now() + 600_000).toISOString() });
    if (insertError) throw insertError;
    return NextResponse.redirect(authorizationUrl(config, state));
  } catch (error) {
    console.error('[MP connect invite] start failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'No pudimos iniciar la conexión con Mercado Pago.' }, { status: 500 });
  }
}
function invalidInvite() {
  return new NextResponse(INVALID_INVITE_HTML, { status: 410, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
export const GET = withRateLimit<RouteContext>(startInvite, { limiter: authRateLimiter, key: (request) => `connect-invite:${getClientIP(request)}` });
