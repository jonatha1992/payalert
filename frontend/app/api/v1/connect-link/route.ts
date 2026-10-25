import { NextRequest, NextResponse } from 'next/server';
import { createClientAppConnectLink } from '@/lib/server/clientAppConnectLinks';
import { authenticateClientApp } from '@/lib/server/hubAuth';
import { corsHeaders } from '@/lib/server/hubHttp';

export async function OPTIONS(request: NextRequest) {
  const auth = await authenticateClientApp(request);
  if (!auth.app) return auth.response!;
  const origin = request.headers.get('origin');
  if (!origin) return NextResponse.json({ error: 'origin_required' }, { status: 403 });
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateClientApp(request);
  if (!auth.app) return auth.response!;
  const origin = request.headers.get('origin');
  const headers = origin ? corsHeaders(origin) : {};
  try {
    const link = await createClientAppConnectLink(auth.app.id, 24 * 60 * 60 * 1000);
    return NextResponse.json(link, { status: 201, headers });
  } catch (error) {
    console.error('hub_connect_link_create_failed', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'connect_link_unavailable' }, { status: 500, headers });
  }
}
