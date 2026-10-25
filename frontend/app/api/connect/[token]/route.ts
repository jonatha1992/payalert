import { NextRequest, NextResponse } from 'next/server';
import { authorizationUrl, createOAuthState, digestOAuthState, newOAuthNonce, oauthConfig } from '@/lib/payments/connectors/mercadopagoOAuth';
import { getServiceClient } from '@/lib/server/session';
import { loadConnectLink } from '@/lib/server/clientAppConnectLinks';

export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  try {
    const link = await loadConnectLink(token);
    if (!link) return NextResponse.json({ error: 'connect_link_invalid' }, { status: 410 });
    const db = getServiceClient();
    const { data: app, error: appError } = await db.from('client_apps').select('slug').eq('id', link.app.id).maybeSingle();
    if (appError) throw appError;
    if (!app) return NextResponse.json({ error: 'connect_link_invalid' }, { status: 410 });
    return NextResponse.json({ slug: app.slug });
  } catch (error) {
    console.error('connect_link_lookup_failed', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'connect_link_unavailable' }, { status: 500 });
  }
}

export async function POST(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  try {
    const link = await loadConnectLink(token);
    if (!link) return NextResponse.json({ error: 'connect_link_invalid' }, { status: 410 });
    const db = getServiceClient();
    const { data: app, error: appError } = await db.from('client_apps').select('business_id').eq('id', link.app.id).maybeSingle();
    if (appError) throw appError;
    if (!app) return NextResponse.json({ error: 'connect_link_invalid' }, { status: 410 });
    const config = oauthConfig();
    if (!config || !process.env.MP_OAUTH_STATE_SECRET) return NextResponse.json({ error: 'oauth_unavailable' }, { status: 503 });
    const nonce = newOAuthNonce();
    const state = createOAuthState({ tenantId: app.business_id, userId: '', nonce, issuedAt: Math.floor(Date.now() / 1000), clientAppId: link.app.id, connectLinkId: link.id });
    const { data: inserted, error: stateError } = await db.from('mp_oauth_states').insert({ state_hash: digestOAuthState(state), business_id: app.business_id, user_id: null, nonce_hash: digestOAuthState(nonce), expires_at: new Date(Date.now() + 600_000).toISOString(), connect_link_id: link.id }).select('state_hash').maybeSingle();
    if (stateError) throw stateError;
    if (!inserted) throw new Error('OAuth state was not stored');
    return NextResponse.json({ authorizationUrl: authorizationUrl(config, state) });
  } catch (error) {
    console.error('connect_link_oauth_start_failed', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'No pudimos iniciar la conexión.' }, { status: 500 });
  }
}
