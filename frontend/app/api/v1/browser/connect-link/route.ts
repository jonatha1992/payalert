import { NextRequest, NextResponse } from 'next/server';
import { loadClientApp } from '@/lib/server/clientApps';
import { createConnectInvite, ConnectInviteError } from '@/lib/server/connectInvites';
import { verifyFirebaseIdToken } from '@/lib/server/firebaseIdToken';
import { corsHeaders } from '@/lib/server/hubHttp';

function cors(origin: string | null, allowed: boolean) {
  return allowed && origin ? corsHeaders(origin) : undefined;
}

async function resolveApp(request: NextRequest) {
  const origin = request.headers.get('origin');
  let slug: unknown;
  try { slug = (await request.json()).app; } catch { return { response: NextResponse.json({ error: 'Ingresá una app válida.' }, { status: 400 }) }; }
  if (typeof slug !== 'string' || !slug) return { response: NextResponse.json({ error: 'Ingresá una app válida.' }, { status: 400 }) };
  const app = await loadClientApp(slug);
  if (!app) return { response: NextResponse.json({ error: 'App no encontrada.' }, { status: 404 }) };
  if (!origin || !app.allowed_origins.includes(origin)) return { response: NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 }) };
  return { app, origin };
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const slug = new URL(request.url).searchParams.get('app');
  if (!slug || !origin) return new NextResponse(null, { status: 403 });
  const app = await loadClientApp(slug);
  if (!app || !app.allowed_origins.includes(origin)) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: { ...corsHeaders(origin), 'Access-Control-Allow-Headers': 'Authorization, Content-Type' } });
}

export async function POST(request: NextRequest) {
  const resolved = await resolveApp(request);
  if ('response' in resolved) return resolved.response;
  const { app, origin } = resolved;
  const headers = cors(origin, true);
  if (!app.firebase_project_id) return NextResponse.json({ error: 'La app no tiene un proyecto Firebase configurado.' }, { status: 400, headers });
  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  const identity = token ? await verifyFirebaseIdToken(token, app.firebase_project_id) : null;
  if (!identity) return NextResponse.json({ error: 'Token de Firebase inválido.' }, { status: 401, headers });
  if (!(app.owner_emails ?? []).map((email) => email.toLowerCase()).includes(identity.email)) return NextResponse.json({ error: 'Solo la dueña puede conectar Mercado Pago' }, { status: 403, headers });
  if (app.connection_id) return NextResponse.json({ connected: true }, { headers });
  try {
    return NextResponse.json(await createConnectInvite(app.id, request.url), { headers });
  } catch (error) {
    if (error instanceof ConnectInviteError) return NextResponse.json({ error: error.message }, { status: 503, headers });
    console.error('[Browser connect link] request failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'No pudimos generar el enlace de conexión.' }, { status: 500, headers });
  }
}
