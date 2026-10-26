import { createHash, randomBytes } from 'node:crypto';
import { getServiceClient } from '@/lib/server/session';

export class ConnectInviteError extends Error {}

export async function createConnectInvite(appId: string, requestUrl: string) {
  const db = getServiceClient();
  const token = 'ci_' + randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error } = await db.from('connect_invites').insert({ client_app_id: appId, token_hash: tokenHash, expires_at: expiresAt });
  if (error) {
    if (['42P01', 'PGRST205'].includes(error.code ?? '') || /connect_invites|schema cache/i.test(error.message ?? '')) {
      throw new ConnectInviteError('No se pueden generar invitaciones: faltan las migraciones 021_connect_invites/022 en la base de datos.');
    }
    throw error;
  }
  const base = process.env.PAYALERT_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? new URL(requestUrl).origin;
  return { url: new URL('/connect/' + encodeURIComponent(token), base).toString(), expires_at: expiresAt };
}
