import { NextRequest, NextResponse } from 'next/server';
import { loadClientApp, originAllowedForAnyApp } from '@/lib/server/clientApps';
import { corsHeaders } from '@/lib/server/hubHttp';
import { verifyFirebaseIdToken } from '@/lib/server/firebaseIdToken';
import { getServiceClient } from '@/lib/server/session';
export async function OPTIONS(request: NextRequest) { const origin=request.headers.get('origin'); if(!origin || !await originAllowedForAnyApp(origin)) return new NextResponse(null,{status:403}); return new NextResponse(null,{status:204,headers:{...corsHeaders(origin),'Access-Control-Allow-Methods':'GET, PATCH, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'}}); }
export async function GET(request: NextRequest) { const origin=request.headers.get('origin'); const slug=new URL(request.url).searchParams.get('app'); if(!slug) return NextResponse.json({error:'invalid_app',code:'invalid_app'},{status:400}); const app=await loadClientApp(slug); if(!app) return NextResponse.json({error:'app_not_found',code:'app_not_found'},{status:404}); if(!origin || !app.allowed_origins.includes(origin)) return NextResponse.json({error:'origin_not_allowed',code:'origin_not_allowed'},{status:403}); return NextResponse.json({deposit:app.deposit_default,connected:!!app.connection_id},{headers:corsHeaders(origin)}); }

function masked(email: string | undefined) { return email ? `${email[0]}***@${email.split('@')[1] ?? ''}` : null; }
const patchCors = (origin: string) => ({ ...corsHeaders(origin), 'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' });

// La dueña cambia el monto de la seña desde su app; PayAlert es la única fuente del monto.
export async function PATCH(request: NextRequest) {
  const origin = request.headers.get('origin'); let app: Awaited<ReturnType<typeof loadClientApp>> = null; let email: string | undefined;
  const audit = async (etapa: string, code: string, status: number, extra: Record<string, unknown> = {}) => {
    try { await getServiceClient().from('audit_logs').insert({ action: 'browser_deposit_update', entity_type: 'client_app', entity_id: app?.id ?? null, business_id: app?.business_id ?? null, user_id: null, new_data: { etapa, code, status, email: masked(email), origin, ...extra }, ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null, user_agent: request.headers.get('user-agent') }); }
    catch (error) { console.error('[browser/config] etapa=bitacora reason=insert_failed', error); }
  };
  const fail = async (etapa: string, code: string, message: string, status: number, allowed = false) => {
    console.error(`[browser/config] etapa=${etapa} reason=${code}`); await audit(etapa, code, status);
    return NextResponse.json({ error: message, code }, { status, headers: allowed && origin ? patchCors(origin) : undefined });
  };
  let body: { app?: unknown; deposit?: unknown };
  try { body = await request.json(); } catch { return fail('body', 'invalid_body', 'Datos inválidos.', 400); }
  if (typeof body.app !== 'string' || !body.app) return fail('body', 'invalid_app', 'Ingresá una app válida.', 400);
  try { app = await loadClientApp(body.app); } catch { return fail('app', 'app_lookup_failed', 'No pudimos cargar la app.', 500); }
  if (!app) return fail('app', 'app_not_found', 'App no encontrada.', 404);
  if (!origin || !app.allowed_origins.includes(origin)) return fail('origin', 'origin_not_allowed', 'Origen no permitido.', 403);
  if (!app.firebase_project_id) return fail('app', 'firebase_not_configured', 'La app no tiene un proyecto Firebase configurado.', 400, true);
  const token = (request.headers.get('authorization') ?? '').match(/^Bearer\s+(.+)$/i)?.[1];
  let identity;
  try { identity = token ? await verifyFirebaseIdToken(token, app.firebase_project_id) : { ok: false as const, reason: 'malformed' as const }; } catch { return fail('token', 'token_verification_failed', 'No pudimos validar tu sesión, probá de nuevo', 502, true); }
  if (!identity.ok) return fail('token', identity.reason, identity.reason === 'token_expired' ? 'Tu sesión venció, cerrá sesión y volvé a entrar' : 'Sesión inválida.', identity.reason === 'jwks_fetch_failed' ? 502 : 401, true);
  email = identity.email;
  if (!(app.owner_emails ?? []).map((v) => v.toLowerCase()).includes(identity.email)) return fail('owner', 'not_owner', 'Solo la dueña puede cambiar la seña', 403, true);
  const deposit = body.deposit;
  if (typeof deposit !== 'number' || !Number.isInteger(deposit) || deposit < 1 || deposit > 1_000_000) return fail('body', 'invalid_deposit', 'La seña debe ser un número entero entre $1 y $1.000.000', 400, true);
  const { error } = await getServiceClient().from('client_apps').update({ deposit_default: deposit }).eq('id', app.id);
  if (error) return fail('db', 'db_error', 'No pudimos guardar la seña.', 500, true);
  await audit('complete', 'ok', 200, { old_deposit: app.deposit_default, new_deposit: deposit });
  return NextResponse.json({ deposit }, { headers: patchCors(origin) });
}
