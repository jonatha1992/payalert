import type { PaymentConnection } from './types';

export interface RenewedTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface TokenRefreshDependencies {
  refresh(refreshToken: string): Promise<RenewedTokens>;
  /** Guarda las credenciales nuevas (cifradas) en la base. */
  persist(connection: PaymentConnection, credentials: Record<string, string>): Promise<void>;
  /** Marca la conexión como que el comerciante debe volver a autorizar. */
  markReauthRequired(connection: PaymentConnection): Promise<void>;
  now?: () => number;
}

const RENEW_MARGIN_MS = 5 * 60_000;

/**
 * Devuelve la conexión con un token vigente. Renueva solo las conexiones OAuth
 * que vencen en menos de 5 minutos; las cargadas a mano no se tocan.
 */
export async function ensureFreshCredentials(
  connection: PaymentConnection,
  dependencies: TokenRefreshDependencies,
): Promise<PaymentConnection> {
  const now = dependencies.now ?? Date.now;
  const credentials = connection.credentials;
  if (credentials.auth_type !== 'oauth') return connection;
  const expiry = Date.parse(credentials.expires_at ?? '');
  if (!Number.isFinite(expiry) || expiry > now() + RENEW_MARGIN_MS) return connection;
  try {
    if (!credentials.refresh_token) throw new Error('missing_refresh_token');
    const renewed = await dependencies.refresh(credentials.refresh_token);
    const next = { ...credentials, access_token: renewed.access_token, refresh_token: renewed.refresh_token,
      expires_at: new Date(now() + renewed.expires_in * 1000).toISOString() };
    await dependencies.persist(connection, next);
    return { ...connection, credentials: next };
  } catch {
    await dependencies.markReauthRequired(connection);
    throw new Error('oauth_refresh_failed');
  }
}
