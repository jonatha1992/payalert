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
import {
  getServiceClient,
  getSessionProfile,
  scopeErrorResponse,
} from "@/lib/server/session";

function unavailable() {
  return NextResponse.json(
    { error: "OAuth de Mercado Pago no está disponible." },
    { status: 503 },
  );
}
function safeError(error: unknown) {
  return error instanceof Error ? error.message : "unknown";
}

export async function GET(request: NextRequest) {
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

export async function PUT(request: NextRequest) {
  try {
    const profile = await getSessionProfile(request);
    if (!profile) throw new ScopeError("No autenticado", 401);
    if (profile.role !== "owner")
      throw new ScopeError("Permiso insuficiente", 403);
    const config = oauthConfig();
    if (!config || !process.env.MP_OAUTH_STATE_SECRET) return unavailable();
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    if (!code || !state) throw new ScopeError("Respuesta OAuth inválida", 400);
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
    const db = getServiceClient();
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
