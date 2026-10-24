import { createHash, randomBytes } from 'node:crypto';

export function createInviteToken(): string { return `ci_${randomBytes(32).toString('base64url')}`; }
export function inviteTokenHash(token: string): string { return createHash('sha256').update(token).digest('hex'); }
export function inviteUrl(token: string, baseUrl: string): string { return `${baseUrl.replace(/\/$/, '')}/connect/${encodeURIComponent(token)}`; }

export type InviteDatabase = { from(table: 'connect_invites'): { insert(row: { client_app_id: string; token_hash: string; expires_at: string }): Promise<{ error: { code?: string } | null }> } };
export type ClientAppsInviteDatabase = InviteDatabase & { from(table: 'client_apps'): { select(columns: string): { eq(field: 'slug', value: string): { maybeSingle(): Promise<{ data: { id: string; business_id: string; active: boolean; allowed_origins: string[] } | null; error: { code?: string } | null }> } }; update(values: { connect_return_url: string; allowed_origins: string[] }): { eq(field: 'id', value: string): { eq(field: 'business_id', value: string): Promise<{ error: { code?: string } | null }> } } } };

export async function createConnectInvite(db: InviteDatabase, app: { id: string }, options: { hours: number; baseUrl: string; now?: Date }): Promise<string> {
  const token = createInviteToken();
  const now = options.now ?? new Date();
  const { error } = await db.from('connect_invites').insert({ client_app_id: app.id, token_hash: inviteTokenHash(token), expires_at: new Date(now.getTime() + options.hours * 3_600_000).toISOString() });
  if (error) throw new Error(`Invite creation failed (${error.code || 'database_error'})`);
  return inviteUrl(token, options.baseUrl);
}

export function connectReturnUrlForAdmin(origin: string): string {
  const url = new URL('/dashboard/apps', origin);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid PayAlert origin');
  return url.toString();
}
