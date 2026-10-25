import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { getServiceClient } from '@/lib/server/session';

export function hashConnectToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createClientAppConnectLink(appId: string, expiresInMs: number) {
  const db = getServiceClient();
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + expiresInMs).toISOString();
  const { data: linkId, error } = await db.rpc('create_client_app_connect_link', {
    p_client_app_id: appId,
    p_token_hash: hashConnectToken(token),
    p_expires_at: expiresAt,
  });
  if (error) throw error;
  if (!linkId) throw new Error('Could not persist client-app connect link');
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) throw new Error('NEXT_PUBLIC_APP_URL is not configured');
  return { url: `${baseUrl.replace(/\/$/, '')}/connect/${token}`, expiresAt };
}

export async function loadConnectLink(token: string) {
  const { data, error } = await getServiceClient().from('client_app_connect_links')
    .select('id,client_app_id,expires_at,used_at,client_apps(id,slug,business_id,allowed_origins,connect_return_url)')
    .eq('token_hash', hashConnectToken(token)).maybeSingle();
  if (error) throw error;
  if (!data || data.used_at || new Date(data.expires_at).getTime() <= Date.now()) return null;
  const app = data.client_apps as unknown as { id: string; slug: string; business_id: string; allowed_origins: string[]; connect_return_url: string | null } | null;
  if (!app) return null;
  return { id: data.id as string, app };
}
