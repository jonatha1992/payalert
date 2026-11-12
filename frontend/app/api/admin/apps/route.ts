import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/scope';
import { getServiceClient, getSessionProfile, scopeErrorResponse } from '@/lib/server/session';

export async function GET(request: NextRequest) {
  try {
    requireRole(await getSessionProfile(request), ['owner']);
    const { data, error } = await getServiceClient()
      .from('client_apps')
      .select('slug,active,allowed_origins,deposit_default,connect_return_url,connection_id,payment_connections(provider,provider_account_id,status)')
      .order('slug');
    if (error) throw error;
    const apps = (data ?? []).map((row) => {
      const connection = Array.isArray(row.payment_connections) ? row.payment_connections[0] : row.payment_connections;
      const connected = row.connection_id !== null && connection?.status === 'CONNECTED';
      return {
        slug: row.slug,
        active: row.active,
        allowed_origins: row.allowed_origins,
        deposit_default: row.deposit_default,
        connect_return_url: row.connect_return_url,
        connected,
        account: connected && connection ? {
          provider: connection.provider,
          provider_account_id: connection.provider_account_id,
        } : null,
      };
    });
    return NextResponse.json({ apps });
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    console.error('[Admin apps] list failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'No pudimos cargar las apps.' }, { status: 500 });
  }
}
