import 'server-only';
import { getServiceClient } from '@/lib/server/session';

export type ClientApp = {
  id: string; slug: string; business_id: string; connection_id: string;
  allowed_origins: string[]; firebase_project_id: string; firebase_sa_encrypted: string;
  admin_emails: string[]; deposit_default: number;
};

export async function loadClientApp(slug: string): Promise<ClientApp | null> {
  const { data, error } = await getServiceClient().from('client_apps').select('*')
    .eq('slug', slug).eq('active', true).maybeSingle();
  if (error) throw error;
  return data as ClientApp | null;
}

export function originAllowed(app: ClientApp, origin: string | null): boolean {
  return !!origin && app.allowed_origins.includes(origin);
}

export async function originAllowedForAnyApp(origin: string): Promise<boolean> {
  const { data, error } = await getServiceClient().from('client_apps').select('allowed_origins').eq('active', true);
  if (error) throw error;
  return (data ?? []).some((app) => app.allowed_origins.includes(origin));
}
