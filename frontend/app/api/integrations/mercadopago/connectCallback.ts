import { NextRequest, NextResponse } from 'next/server';
import {
  digestOAuthState,
  exchangeAuthorizationCode,
  oauthConfig,
  verifyOAuthState,
} from '@/lib/payments/connectors/mercadopagoOAuth';
import { encryptSecret } from '@/lib/payments/secretBox';
import { recordAuditEvent } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/server/session';


type OAuthIdentity = { tenantId?: string; userId?: string; clientAppId?: string; connectLinkId?: string };
type OAuthTokens = Awaited<ReturnType<typeof exchangeAuthorizationCode>>;
type Database = ReturnType<typeof getServiceClient>;

export async function handleClientAppCallback(request: NextRequest, state: string, identity: OAuthIdentity) {
  let returnUrl: string | null = null;
  try {
    const config = oauthConfig();
    if (!config || !process.env.MP_OAUTH_STATE_SECRET || !identity.tenantId || !identity.clientAppId || !identity.connectLinkId || identity.userId !== '') throw new Error('OAuth connect state invalid');
    const db = getServiceClient();
    const auditDb = getServiceClient();
    const payload = verifyOAuthState(state, { tenantId: identity.tenantId, userId: '' });
    if (payload.clientAppId !== identity.clientAppId || payload.connectLinkId !== identity.connectLinkId) throw new Error('OAuth connect state mismatch');
    const { data: app, error: appError } = await db.from('client_apps').select('id,business_id,allowed_origins,connect_return_url').eq('id', identity.clientAppId).eq('business_id', identity.tenantId).maybeSingle();
    if (appError) throw appError;
    if (!app) throw new Error('Client app not found');
    returnUrl = app.connect_return_url;
    if (!returnUrl || !isAllowedConnectReturn(returnUrl, app.allowed_origins)) throw new Error('Client app return URL is not allowed');
    const now = new Date().toISOString();
    const { data: claimedState, error: stateError } = await db.from('mp_oauth_states').update({ consumed_at: now }).eq('state_hash', digestOAuthState(state)).eq('business_id', identity.tenantId).is('user_id', null).eq('connect_link_id', identity.connectLinkId).is('consumed_at', null).gt('expires_at', now).select('state_hash').maybeSingle();
    if (stateError) throw stateError;
    if (!claimedState) throw new Error('OAuth state expired or already used');
    const { data: claimedLink, error: linkError } = await db.from('client_app_connect_links').update({ used_at: now }).eq('id', identity.connectLinkId).eq('client_app_id', identity.clientAppId).is('used_at', null).gt('expires_at', now).select('id').maybeSingle();
    if (linkError) throw linkError;
    if (!claimedLink) throw new Error('Connect link expired or already used');
    const code = request.nextUrl.searchParams.get('code');
    if (!code) throw new Error('OAuth code missing');
    const tokens = await exchangeAuthorizationCode(code, config);
    const accountId = await mercadoPagoAccountId(tokens);
    const credentials = { access_token: tokens.access_token, refresh_token: tokens.refresh_token, expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(), auth_type: 'oauth' };
    const connectionId = await saveOAuthConnection(db, { businessId: identity.tenantId, accountId, credentials, createdBy: null, syncedAt: now });
    const { error: updateError } = await db.from('client_apps').update({ connection_id: connectionId }).eq('id', identity.clientAppId).eq('business_id', identity.tenantId);
    if (updateError) throw updateError;
    const { data: profile, error: profileError } = await auditDb.from('users').select('id').eq('business_id', identity.tenantId).eq('role', 'owner').limit(1).maybeSingle();
    if (profileError || !profile) throw new Error('Audit actor unavailable');
    await recordAuditEvent(auditDb, { businessId: identity.tenantId, actorId: profile.id, action: 'CONFIGURATION_UPDATED', entityType: 'client_app_connection', entityId: identity.clientAppId, newData: { provider: 'mercado_pago', auth: 'oauth' } });
    return NextResponse.redirect(withMpResult(returnUrl, 'connected'));
  } catch (error) {
    console.error('[MP client-app OAuth callback] failed:', error instanceof Error ? error.message : 'unknown');
    returnUrl = returnUrl ?? await safeClientAppReturnUrl(identity.clientAppId);
    return NextResponse.redirect(returnUrl ? withMpResult(returnUrl, 'error') : new URL('/?mp=error', request.url));
  }
}

function isAllowedConnectReturn(value: string, origins: string[]): boolean {
  try { const target = new URL(value); return target.protocol === 'https:' && origins.some((origin) => { try { return new URL(origin).origin === target.origin; } catch { return false; } }); } catch { return false; }
}
function withMpResult(value: string, result: 'connected' | 'error'): URL { const target = new URL(value); target.searchParams.set('mp', result); return target; }
async function safeClientAppReturnUrl(appId?: string): Promise<string | null> {
  if (!appId) return null;
  try { const { data, error } = await getServiceClient().from('client_apps').select('connect_return_url,allowed_origins').eq('id', appId).maybeSingle(); if (error) throw error; return data?.connect_return_url && isAllowedConnectReturn(data.connect_return_url, data.allowed_origins) ? data.connect_return_url : null; } catch { return null; }
}
async function mercadoPagoAccountId(tokens: OAuthTokens): Promise<string> {
  if (tokens.user_id !== undefined) return String(tokens.user_id);
  const response = await fetch('https://api.mercadopago.com/users/me', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  if (!response.ok) throw new Error('Mercado Pago account lookup failed');
  const result = await response.json() as { id?: string | number };
  if (result.id === undefined) throw new Error('Mercado Pago account id missing');
  return String(result.id);
}
async function saveOAuthConnection(db: Database, input: { businessId: string; accountId: string; credentials: Record<string, string>; createdBy: string | null; syncedAt: string }): Promise<string> {
  const { data: existing, error: lookupError } = await db.from('payment_connections').select('id').eq('business_id', input.businessId).eq('provider', 'mercado_pago').eq('provider_account_id', input.accountId).maybeSingle();
  if (lookupError) throw lookupError;
  const encrypted = encryptSecret(JSON.stringify(input.credentials));
  if (existing) { const { error } = await db.from('payment_connections').update({ status: 'CONNECTED', credentials_encrypted: encrypted, provider_account_id: input.accountId, last_error: null, last_sync_at: input.syncedAt }).eq('id', existing.id).eq('business_id', input.businessId); if (error) throw error; return existing.id; }
  const { data, error } = await db.from('payment_connections').insert({ business_id: input.businessId, provider: 'mercado_pago', provider_account_id: input.accountId, status: 'CONNECTED', credentials_encrypted: encrypted, created_by: input.createdBy, last_sync_at: input.syncedAt }).select('id').single();
  if (error) throw error;
  return data.id;
}
