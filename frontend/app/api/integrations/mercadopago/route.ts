import { NextRequest, NextResponse } from "next/server";

import {
  authorizationUrl,
  createOAuthState,
  digestOAuthState,
  newOAuthNonce,
  oauthConfig,
  verifyOAuthState,
  exchangeAuthorizationCode,
} from "@/lib/payments/connectors/mercadopagoOAuth";
import { encryptSecret } from "@/lib/payments/secretBox";
import { recordAuditEvent } from "@/lib/server/audit";
import { can } from "@/lib/server/rbac";
import { ScopeError, resolveScope } from "@/lib/server/scope";
import { getServiceClient, getSessionProfile, scopeErrorResponse } from "@/lib/server/session";
import type { ClientApp } from "@/lib/server/clientApps";

function originAllowed(app: ClientApp, origin: string | null): boolean { return !!origin && app.allowed_origins.includes(origin); }

function unavailable() {
  return NextResponse.json(
    { error: "OAuth de Mercado Pago no está disponible." },
    { status: 503 },
  );
}
function safeError(error: unknown) {
  return error instanceof Error ? error.message : "unknown";
}

export async function PUT(request: NextRequest) {
  return handleCallback(request);
}

export async function GET(request: NextRequest) {
  // Mercado Pago returns the browser here with ?code&state; that is the callback, not a new start.
  const params = request.nextUrl.searchParams;
  if (params.get("code") && params.get("state")) return handleCallback(request);
  if (params.get("error"))
    return NextResponse.redirect(new URL("/dashboard/integrations?oauth=failed", request.url));
  try {
    const profile = await getSessionProfile(request);
    if (!profile) throw new ScopeError("No autenticado", 401);
    if (profile.role !== "owner" || !can(profile.role, "connection", "create"))
      throw new ScopeError("Permiso insuficiente", 403);
    const scope = resolveScope(profile, {
      businessId: request.nextUrl.searchParams.get("businessId"),
    });
    const config = oauthConfig();
    if (!config || !process.env.MP_OAUTH_STATE_SECRET) return unavailable();
    const nonce = newOAuthNonce();
    const state = createOAuthState({
      tenantId: scope.businessId,
      userId: profile.userId,
      nonce,
      issuedAt: Math.floor(Date.now() / 1000),
    });
    const db = getServiceClient();
    const { error } = await db
      .from("mp_oauth_states")
      .insert({
        state_hash: digestOAuthState(state),
        business_id: scope.businessId,
        user_id: profile.userId,
        nonce_hash: digestOAuthState(nonce),
        expires_at: new Date(Date.now() + 600_000).toISOString(),
      });
    if (error) throw error;
    return NextResponse.redirect(authorizationUrl(config, state));
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    console.error("[MP OAuth start] failed:", safeError(error));
    return NextResponse.json(
      { error: "No pudimos iniciar la conexión con Mercado Pago." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await getSessionProfile(request);
    if (!profile) throw new ScopeError("No autenticado", 401);
    if (profile.role !== "owner" || !can(profile.role, "connection", "delete"))
      throw new ScopeError("Permiso insuficiente", 403);
    const { businessId } = resolveScope(profile, {
      businessId: request.nextUrl.searchParams.get("businessId"),
    });
    const id = request.nextUrl.searchParams.get("connectionId");
    if (!id) throw new ScopeError("connectionId requerido", 400);
    const db = getServiceClient();
    const { data, error } = await db
      .from("payment_connections")
      .update({
        status: "DISCONNECTED",
        credentials_encrypted: encryptSecret("{}"),
        webhook_secret_encrypted: null,
        last_error: null,
      })
      .eq("id", id)
      .eq("business_id", businessId)
      .eq("provider", "mercado_pago")
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ScopeError("Integración no encontrada", 403);
    await recordAuditEvent(db, {
      businessId,
      actorId: profile.userId,
      action: "CONFIGURATION_UPDATED",
      entityType: "payment_connection",
      entityId: id,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    console.error("[MP OAuth revoke] failed:", safeError(error));
    return NextResponse.json(
      { error: "No pudimos desconectar Mercado Pago." },
      { status: 500 },
    );
  }
}

async function handleCallback(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code || !state) return NextResponse.redirect(new URL("/dashboard/integrations?oauth=failed", request.url));
  let db: ReturnType<typeof getServiceClient>;
  try { db = getServiceClient(); } catch (error) {
    console.error("[MP OAuth callback] database unavailable:", safeError(error));
    return NextResponse.redirect(new URL("/dashboard/integrations?oauth=failed", request.url));
  }
  try {
    const { data: row, error } = await db.from("mp_oauth_states").select("state_hash,business_id,user_id,invite_id,nonce_hash,expires_at,consumed_at").eq("state_hash", digestOAuthState(state)).maybeSingle();
    if (error) throw error;
    if (row?.invite_id && row.user_id === null) return handleInviteCallback(request, code, state, row, db);
    return await handleOwnerCallback(request, code, state, db);
  } catch (error) {
    console.error("[MP OAuth callback] failed:", safeError(error));
    return NextResponse.redirect(new URL("/dashboard/integrations?oauth=failed", request.url));
  }
}

async function handleOwnerCallback(request: NextRequest, code: string, state: string, db: ReturnType<typeof getServiceClient>) {
  try {
    const profile = await getSessionProfile(request);
    if (!profile) throw new ScopeError("No autenticado", 401);
    if (profile.role !== "owner")
      throw new ScopeError("Permiso insuficiente", 403);
    const config = oauthConfig();
    if (!config || !process.env.MP_OAUTH_STATE_SECRET) return unavailable();
    // One-time claim is atomic: concurrent callback replays cannot both consume the state.
    const statePayload = JSON.parse(
      Buffer.from(state.split(".")[0] ?? "", "base64url").toString("utf8"),
    ) as { tenantId?: string };
    if (!statePayload.tenantId)
      throw new ScopeError("Estado OAuth inválido", 400);
    const scope = resolveScope(profile, { businessId: statePayload.tenantId });
    let payload;
    try {
      payload = verifyOAuthState(state, {
        tenantId: scope.businessId,
        userId: profile.userId,
      });
    } catch {
      throw new ScopeError("Estado OAuth inválido o vencido", 400);
    }
    const now = new Date().toISOString();
    const { data: claimed, error: claimError } = await db
      .from("mp_oauth_states")
      .update({ consumed_at: now })
      .eq("state_hash", digestOAuthState(state))
      .eq("business_id", scope.businessId)
      .eq("user_id", profile.userId)
      .is("consumed_at", null)
      .gt("expires_at", now)
      .select("state_hash")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed)
      throw new ScopeError(
        "Estado OAuth inválido, vencido o ya utilizado",
        400,
      );
    const tokens = await exchangeAuthorizationCode(code, config);
    let accountId: string | null =
      tokens.user_id === undefined ? null : String(tokens.user_id);
    if (!accountId) {
      const me = await fetch("https://api.mercadopago.com/users/me", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (!me.ok) throw new Error("Mercado Pago rechazó la cuenta autorizada");
      const identity = (await me.json()) as { id?: string | number };
      accountId = identity.id === undefined ? null : String(identity.id);
    }
    if (!accountId)
      throw new Error("Mercado Pago no devolvió la cuenta autorizada");
    const credentials = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      auth_type: "oauth",
    };
    const { data: existing, error: existingError } = await db
      .from("payment_connections")
      .select("id")
      .eq("business_id", scope.businessId)
      .eq("provider", "mercado_pago")
      .eq("provider_account_id", accountId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      const { error } = await db
        .from("payment_connections")
        .update({
          status: "CONNECTED",
          credentials_encrypted: encryptSecret(JSON.stringify(credentials)),
          provider_account_id: accountId,
          last_error: null,
          last_sync_at: now,
        })
        .eq("id", existing.id)
        .eq("business_id", scope.businessId);
      if (error) throw error;
    } else {
      const { error } = await db
        .from("payment_connections")
        .insert({
          business_id: scope.businessId,
          provider: "mercado_pago",
          provider_account_id: accountId,
          status: "CONNECTED",
          credentials_encrypted: encryptSecret(JSON.stringify(credentials)),
          created_by: profile.userId,
          last_sync_at: now,
        });
      if (error) throw error;
    }
    await recordAuditEvent(db, {
      businessId: scope.businessId,
      actorId: profile.userId,
      action: "CONFIGURATION_UPDATED",
      entityType: "payment_connection",
      newData: { provider: "mercado_pago", auth: "oauth" },
    });
    return NextResponse.redirect(
      new URL("/dashboard/integrations?oauth=connected", request.url),
    );
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    console.error("[MP OAuth callback] failed:", safeError(error));
    return NextResponse.redirect(
      new URL("/dashboard/integrations?oauth=failed", request.url),
    );
  }
}

async function handleInviteCallback(request: NextRequest, code: string, state: string, row: { state_hash: string; business_id: string; invite_id: string; user_id: null }, db: ReturnType<typeof getServiceClient>) {
  const dashboardOrigin = request.nextUrl.origin;
  const now = new Date().toISOString();
  let app: (ClientApp & { connect_return_url: string | null }) | null = null;
  try {
    const { data: invite, error } = await db.from('connect_invites').select('id,client_app_id,expires_at,used_at,client_apps!inner(id,slug,business_id,active,connect_return_url,allowed_origins,api_key_hash,connection_id,deposit_default)').eq('id', row.invite_id).maybeSingle();
    if (error) throw error;
    const raw = invite as { id: string; client_app_id: string; expires_at: string; used_at: string | null; client_apps: unknown } | null;
    const joined = Array.isArray(raw?.client_apps) ? raw.client_apps[0] : raw?.client_apps;
    app = joined && typeof joined === 'object' ? joined as ClientApp & { connect_return_url: string | null } : null;
    const now = new Date().toISOString();
    if (!raw || raw.used_at || raw.expires_at <= now || raw.client_app_id !== app?.id || app.business_id !== row.business_id || !app.active || !app.connect_return_url || !(originAllowed(app, new URL(app.connect_return_url).origin) || (new URL(app.connect_return_url).origin === dashboardOrigin && new URL(app.connect_return_url).pathname === '/dashboard/apps'))) throw new Error('Connect invitation is invalid, expired, used, or return origin not allowed');
    const config = oauthConfig();
    if (!config || !process.env.MP_OAUTH_STATE_SECRET) throw new Error('OAuth not configured');
    const payload = verifyOAuthState(state, { tenantId: row.business_id, userId: `invite:${row.invite_id}` });
    const { data: claimed, error: claimError } = await db.from('mp_oauth_states').update({ consumed_at: now }).eq('state_hash', row.state_hash).eq('business_id', row.business_id).eq('invite_id', row.invite_id).is('user_id', null).is('consumed_at', null).gt('expires_at', now).select('state_hash').maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) throw new Error('OAuth invitation state already used or expired');
    const tokens = await exchangeAuthorizationCode(code, config);
    const accountId = await resolveAccountId(tokens);
    const connectionId = await saveConnection(db, row.business_id, accountId, tokens, null, now);
    const { error: linkError } = await db.from('client_apps').update({ connection_id: connectionId }).eq('id', app.id).eq('business_id', row.business_id).eq('active', true);
    if (linkError) throw linkError;
    const { data: used, error: useError } = await db.from('connect_invites').update({ used_at: now }).eq('id', row.invite_id).eq('client_app_id', app.id).is('used_at', null).gt('expires_at', now).select('id').maybeSingle();
    if (useError) throw useError;
    if (!used) throw new Error('Invitation already consumed');
    await recordAuditEvent(db, { businessId: row.business_id, actorId: null, action: 'CONFIGURATION_UPDATED', entityType: 'payment_connection', entityId: connectionId, newData: { provider: 'mercado_pago', auth: 'oauth', client_app_id: app.id, invite_id: row.invite_id, nonce: payload.nonce } });
    return NextResponse.redirect(connectReturnUrl(app, 'connected', dashboardOrigin));
  } catch (error) {
    console.error('[MP OAuth invite callback] failed:', safeError(error));
    if (app?.connect_return_url) {
      try {
        if (originAllowed(app, new URL(app.connect_return_url).origin) || (new URL(app.connect_return_url).origin === dashboardOrigin && new URL(app.connect_return_url).pathname === '/dashboard/apps')) return NextResponse.redirect(connectReturnUrl(app, 'failed', dashboardOrigin));
      } catch {
        // Invalid configured return URLs must fall back to PayAlert, never escape the allowlist.
      }
    }
    return NextResponse.redirect(new URL('/dashboard/integrations?oauth=failed', request.url));
  }
}
function connectReturnUrl(app: ClientApp & { connect_return_url: string | null }, status: 'connected' | 'failed', dashboardOrigin: string): URL {
  const url = app.connect_return_url ? new URL(app.connect_return_url) : null;
  if (!url || (!originAllowed(app, url.origin) && !(url.origin === dashboardOrigin && url.pathname === '/dashboard/apps'))) throw new Error('Connect return URL is not allowed');
  if (url.pathname === '/dashboard/apps') url.searchParams.set('connected', app.slug);
  url.searchParams.set('mp', status);
  if (app.slug) url.searchParams.set('slug', app.slug);
  return url;
}
async function resolveAccountId(tokens: Awaited<ReturnType<typeof exchangeAuthorizationCode>>): Promise<string> {
  let id = tokens.user_id === undefined ? null : String(tokens.user_id);
  if (!id) {
    const response = await fetch("https://api.mercadopago.com/users/me", { headers: { Authorization: "Bearer " + tokens.access_token } });
    if (!response.ok) throw new Error('Mercado Pago rechazó la cuenta autorizada');
    const identity = await response.json() as { id?: string | number };
    id = identity.id === undefined ? null : String(identity.id);
  }
  if (!id) throw new Error('Mercado Pago no devolvió la cuenta autorizada');
  return id;
}
async function saveConnection(db: ReturnType<typeof getServiceClient>, businessId: string, accountId: string, tokens: Awaited<ReturnType<typeof exchangeAuthorizationCode>>, actorId: string | null, now: string): Promise<string> {
  const credentials = { access_token: tokens.access_token, refresh_token: tokens.refresh_token, expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(), auth_type: 'oauth' };
  const { data: existing, error: lookupError } = await db.from('payment_connections').select('id').eq('business_id', businessId).eq('provider', 'mercado_pago').eq('provider_account_id', accountId).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) {
    const { error } = await db.from('payment_connections').update({ status: 'CONNECTED', credentials_encrypted: encryptSecret(JSON.stringify(credentials)), provider_account_id: accountId, last_error: null, last_sync_at: now }).eq('id', existing.id).eq('business_id', businessId);
    if (error) throw error;
    return existing.id;
  }
  const { data, error } = await db.from('payment_connections').insert({ business_id: businessId, provider: 'mercado_pago', provider_account_id: accountId, status: 'CONNECTED', credentials_encrypted: encryptSecret(JSON.stringify(credentials)), created_by: actorId, last_sync_at: now }).select('id').single();
  if (error) throw error;
  return data.id as string;
}
