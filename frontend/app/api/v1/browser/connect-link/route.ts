import { NextRequest, NextResponse } from 'next/server';
import { loadClientApp } from '@/lib/server/clientApps';
import { createConnectInvite, ConnectInviteError } from '@/lib/server/connectInvites';
import { verifyFirebaseIdToken } from '@/lib/server/firebaseIdToken';
import { corsHeaders } from '@/lib/server/hubHttp';
import { getServiceClient } from '@/lib/server/session';

function cors(origin: string | null, allowed: boolean) { return allowed && origin ? corsHeaders(origin) : undefined; }
function masked(email: string | undefined) { return email ? `${email[0]}***@${email.split('@')[1] ?? ''}` : null; }

async function audit(request: NextRequest, app: { id: string; business_id: string | null } | null, etapa: string, code: string, status: number, email: string | undefined, origin: string | null) {
  try {
    const db = getServiceClient();
    const { error } = await db.from('audit_logs').insert({ action: 'browser_connect_link', entity_type: 'client_app', entity_id: app?.id ?? null, business_id: app?.business_id ?? null, user_id: null, new_data: { app: app?.id ?? null, etapa, code, status, email: masked(email), origin }, ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null, user_agent: request.headers.get('user-agent') });
    if (error) throw error;
  } catch (error) { console.error('[browser/connect-link] etapa=bitacora reason=insert_failed', error); }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin'); const slug = new URL(request.url).searchParams.get('app');
  if (!slug || !origin) return new NextResponse(null, { status: 403 });
  const app = await loadClientApp(slug);
  if (!app || !app.allowed_origins.includes(origin)) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: { ...corsHeaders(origin), 'Access-Control-Allow-Headers': 'Authorization, Content-Type' } });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin'); let app: Awaited<ReturnType<typeof loadClientApp>> = null; let email: string | undefined;
  const fail = async (etapa: string, code: string, message: string, status: number, allowed = false) => {
    console.error(`[browser/connect-link] etapa=${etapa} reason=${code}`);
    await audit(request, app, etapa, code, status, email, origin);
    return NextResponse.json({ error: message, code }, { status, headers: cors(origin, allowed) });
  };
  let body: { app?: unknown };
  try { body = await request.json(); } catch { return fail('body', 'invalid_body', 'Ingresá una app válida.', 400); }
  if (typeof body.app !== 'string' || !body.app) return fail('body', 'invalid_app', 'Ingresá una app válida.', 400);
  try { app = await loadClientApp(body.app); } catch { return fail('app', 'app_lookup_failed', 'No pudimos cargar la app.', 500); }
  if (!app) return fail('app', 'app_not_found', 'App no encontrada.', 404);
  if (!origin || !app.allowed_origins.includes(origin)) return fail('origin', 'origin_not_allowed', 'Origen no permitido.', 403);
  if (!app.firebase_project_id) return fail('app', 'firebase_not_configured', 'La app no tiene un proyecto Firebase configurado.', 400);
  const authorization = request.headers.get('authorization') ?? ''; const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  let identity;
  try { identity = token ? await verifyFirebaseIdToken(token, app.firebase_project_id) : { ok: false as const, reason: 'malformed' as const }; } catch { return fail('token', 'token_verification_failed', 'No pudimos validar tu sesión con Google, probá de nuevo', 502, true); }
  if (!identity.ok) {
    const messages: Record<string, string> = { token_expired: 'Tu sesión venció, cerrá sesión y volvé a entrar', wrong_audience: 'La app no está configurada para este proyecto Firebase', jwks_fetch_failed: 'No pudimos validar tu sesión con Google, probá de nuevo' };
    return fail('token', identity.reason, messages[identity.reason] ?? 'Token de Firebase inválido.', identity.reason === 'jwks_fetch_failed' ? 502 : 401, true);
  }
  email = identity.email;
  if (!(app.owner_emails ?? []).map((value) => value.toLowerCase()).includes(identity.email)) return fail('owner', 'not_owner', 'Solo la dueña puede conectar Mercado Pago', 403, true);
  if (app.connection_id) { await audit(request, app, 'complete', 'already_connected', 200, email, origin); return NextResponse.json({ connected: true }, { headers: cors(origin, true) }); }
  try {
    const result = await createConnectInvite(app.id, request.url);
    await audit(request, app, 'complete', 'ok', 200, email, origin);
    return NextResponse.json(result, { headers: cors(origin, true) });
  } catch (error) {
    if (error instanceof ConnectInviteError) return fail('invite', 'invite_unavailable', error.message, 503, true);
    return fail('invite', 'invite_failed', 'No pudimos generar el enlace de conexión.', 500, true);
  }
}
