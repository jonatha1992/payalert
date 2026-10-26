import { NextRequest, NextResponse } from 'next/server';
import { authenticateClientApp } from '@/lib/server/hubAuth';
import { ConnectInviteError, createConnectInvite } from '@/lib/server/connectInvites';
import { corsHeaders } from '@/lib/server/hubHttp';

export async function OPTIONS(request: NextRequest) {
  const { app, response } = await authenticateClientApp(request);
  return app ? new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get('origin')!) }) : response!;
}

export async function POST(request: NextRequest) {
  const { app, response } = await authenticateClientApp(request);
  if (response) return response;
  const headers = corsHeaders(request.headers.get('origin')!);
  if (typeof app.connection_id === 'string' && app.connection_id.length > 0) {
    return NextResponse.json({ error: 'Ya hay una cuenta de Mercado Pago conectada' }, { status: 409, headers });
  }
  try {
    return NextResponse.json(await createConnectInvite(app.id, request.url), { headers });
  } catch (error) {
    if (error instanceof ConnectInviteError) return NextResponse.json({ error: error.message }, { status: 503, headers });
    console.error('[Hub connect link] request failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'No pudimos generar el enlace de conexión.' }, { status: 500, headers });
  }
}
