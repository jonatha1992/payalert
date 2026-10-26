import { NextRequest, NextResponse } from 'next/server';
import { loadClientApp } from '@/lib/server/clientApps';
import { corsHeaders } from '@/lib/server/hubHttp';

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const slug = new URL(request.url).searchParams.get('app');
  if (!slug || !origin) return new NextResponse(null, { status: 403 });
  const app = await loadClientApp(slug);
  if (!app || !app.allowed_origins.includes(origin)) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  const slug = new URL(request.url).searchParams.get('app');
  if (!slug) return NextResponse.json({ error: 'Ingresá una app válida.' }, { status: 400 });
  const app = await loadClientApp(slug);
  if (!app) return NextResponse.json({ error: 'App no encontrada.' }, { status: 404 });
  if (!origin || !app.allowed_origins.includes(origin)) return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
  return NextResponse.json({ connected: Boolean(app.connection_id) }, { headers: corsHeaders(origin) });
}
