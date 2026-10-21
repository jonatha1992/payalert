import { NextRequest, NextResponse } from 'next/server';
import { authenticateClientApp } from '@/lib/server/hubAuth';
import { getServiceClient } from '@/lib/server/session';
import { corsHeaders } from '@/lib/server/hubHttp';

export async function OPTIONS(request: NextRequest) {
  const { app, response } = await authenticateClientApp(request);
  return app ? new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get('origin')!) }) : response!;
}

export async function GET(request: NextRequest) {
  const { app, response } = await authenticateClientApp(request);
  if (response) return response;
  const headers = corsHeaders(request.headers.get('origin')!);

  let connected = false;
  if (app.connection_id) {
    const { data, error } = await getServiceClient().from('payment_connections').select('status')
      .eq('id', app.connection_id).eq('business_id', app.business_id).maybeSingle();
    if (error) throw error;
    connected = data?.status === 'CONNECTED';
  }

  return NextResponse.json({ connected, deposit_default: app.deposit_default }, { headers });
}
