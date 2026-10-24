import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/scope';
import { getServiceClient, getSessionProfile, scopeErrorResponse } from '@/lib/server/session';
import { createConnectInvite, connectReturnUrlForAdmin, type ClientAppsInviteDatabase } from '@/lib/server/connectInvites';

type Context = { params: Promise<{ slug: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    requireRole(await getSessionProfile(request), ['owner']);
    const { slug } = await context.params;
    const db = getServiceClient() as unknown as ClientAppsInviteDatabase;
    const { data: app, error } = await db.from('client_apps').select('id,business_id,active,allowed_origins').eq('slug', slug).maybeSingle();
    if (error) throw error;
    if (!app || !app.active) return NextResponse.json({ error: 'App inexistente o inactiva.' }, { status: 404 });
    const returnUrl = connectReturnUrlForAdmin(request.nextUrl.origin);
    const update = await db.from('client_apps').update({ connect_return_url: returnUrl, allowed_origins: [...new Set([...app.allowed_origins, request.nextUrl.origin])] }).eq('id', app.id).eq('business_id', app.business_id);
    if (update.error) throw update.error;
    const url = await createConnectInvite(db, app, { hours: 1, baseUrl: request.nextUrl.origin });
    return NextResponse.json({ url });
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    console.error('[Admin app connect] failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'No pudimos iniciar la conexión.' }, { status: 500 });
  }
}
