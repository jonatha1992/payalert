import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const MP_OAUTH_SCOPES = process.env.MP_OAUTH_SCOPES ?? "offline_access read write";
export const MP_AUTHORIZATION_URL =
  "https://auth.mercadopago.com/authorization";
export const MP_TOKEN_URL = "https://api.mercadopago.com/oauth/token";
export const MP_STATE_TTL_SECONDS = 600;

export interface OAuthStatePayload {
  tenantId: string;
  userId: string;
  nonce: string;
  issuedAt: number;
}
export interface MercadoPagoTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id?: string | number;
}
export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function oauthConfig(
  env: NodeJS.ProcessEnv = process.env,
): OAuthConfig | null {
  if (
    env.MP_OAUTH_ENABLED !== "true" ||
    !env.MP_CLIENT_ID ||
    !env.MP_CLIENT_SECRET ||
    !env.MP_OAUTH_REDIRECT_URI
  )
    return null;
  try {
    const callback = new URL(env.MP_OAUTH_REDIRECT_URI);
    if (callback.protocol !== "https:" && callback.hostname !== "localhost")
      return null;
  } catch {
    return null;
  }
  return {
    clientId: env.MP_CLIENT_ID,
    clientSecret: env.MP_CLIENT_SECRET,
    redirectUri: env.MP_OAUTH_REDIRECT_URI,
  };
}

export function createOAuthState(
  payload: OAuthStatePayload,
  secret = process.env.MP_OAUTH_STATE_SECRET,
): string {
  if (!secret || secret.length < 32)
    throw new Error(
      "MP_OAUTH_STATE_SECRET must contain at least 32 characters",
    );
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

export function verifyOAuthState(
  state: string,
  expected: { tenantId: string; userId: string },
  now = Date.now(),
  secret = process.env.MP_OAUTH_STATE_SECRET,
): OAuthStatePayload {
  if (!secret || secret.length < 32)
    throw new Error("OAuth state signing is not configured");
  const [body, signature, extra] = state.split(".");
  if (!body || !signature || extra) throw new Error("Invalid OAuth state");
  const actual = Buffer.from(
    createHmac("sha256", secret).update(body).digest("base64url"),
  );
  const supplied = Buffer.from(signature);
  if (actual.length !== supplied.length || !timingSafeEqual(actual, supplied))
    throw new Error("Invalid OAuth state signature");
  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as OAuthStatePayload;
  } catch {
    throw new Error("Invalid OAuth state payload");
  }
  const age = Math.floor(now / 1000) - payload.issuedAt;
  if (
    payload.tenantId !== expected.tenantId ||
    payload.userId !== expected.userId ||
    !payload.nonce ||
    age < 0 ||
    age > MP_STATE_TTL_SECONDS
  )
    throw new Error("Expired or mismatched OAuth state");
  return payload;
}

async function tokenRequest(
  body: URLSearchParams,
  fetchImpl: typeof fetch,
): Promise<MercadoPagoTokens> {
  const response = await fetchImpl(MP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok)
    throw new Error(`Mercado Pago OAuth request failed (${response.status})`);
  const json: unknown = await response.json();
  if (!json || typeof json !== "object")
    throw new Error("Invalid Mercado Pago OAuth response");
  const token = json as Partial<MercadoPagoTokens>;
  if (
    typeof token.access_token !== "string" ||
    !token.access_token ||
    typeof token.refresh_token !== "string" ||
    !token.refresh_token ||
    typeof token.expires_in !== "number" ||
    token.expires_in <= 0
  )
    throw new Error("Incomplete Mercado Pago OAuth response");
  return token as MercadoPagoTokens;
}

export function exchangeAuthorizationCode(
  code: string,
  config: OAuthConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<MercadoPagoTokens> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  });
  return tokenRequest(body, fetchImpl);
}

export function refreshAccessToken(
  refreshToken: string,
  config: OAuthConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<MercadoPagoTokens> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return tokenRequest(body, fetchImpl);
}

export function authorizationUrl(config: OAuthConfig, state: string): string {
  const url = new URL(MP_AUTHORIZATION_URL);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    platform_id: "mp",
    state,
    redirect_uri: config.redirectUri,
    scope: MP_OAUTH_SCOPES,
  }).toString();
  return url.toString();
}

export function newOAuthNonce(): string {
  return randomBytes(32).toString("base64url");
}
export function digestOAuthState(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}
