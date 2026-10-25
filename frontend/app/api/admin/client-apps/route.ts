import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionProfile, getServiceClient } from '@/lib/server/session';
import { ScopeError } from '@/lib/server/scope';
import { recordAuditEvent } from '@/lib/server/audit';
import { validationSchemas } from '@/lib/validation/schemas';

function authorize(profile: Awaited<ReturnType<typeof getSessionProfile>>) {
  if (!profile) throw new ScopeError('No autenticado', 401);
  if (profile.role !== 'admin') throw new ScopeError('Permiso insuficiente', 403);
  return profile;
}

function originsValid(input: unknown): input is string[] {
  return Array.isArray(input) && input.length > 0 && input.every((origin) =>
    typeof origin === 'string' && !origin.includes('*') &&
    (/^https:\/\/[^/\s]+(?::\d+)?$/.test(origin) || /^http:\/\/localhost(?::\d+)?$/.test(origin))
  ) && new Set(input).size === input.length;
}

function keyFor(slug: string) {
  return `pa_${slug}_${randomBytes(32).toString('base64url')}`;
}

function errorResponse(error: unknown) {
  if (error instanceof ScopeError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error('[Admin client apps] request failed:', error instanceof Error ? error.message : 'unknown');
  return NextResponse.json({ error: 'No pudimos procesar las apps vinculadas.' }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    authorize(await getSessionProfile(request));
    const db = getServiceClient();
    const { data, error } = await db.from('client_apps').select('id, slug, business_id, connection_id, allowed_origins, deposit_default, item_title, active, created_at, businesses(name), payment_connections(provider, status)').order('created_at', { ascending: false });
    if (error) throw error;
    const ids = (data ?? []).map((app) => app.id);
    const { data: charges, error: chargesError } = ids.length
      ? await db.from('hub_charges').select('client_app_id, amount, status, created_at').in('client_app_id', ids)
      : { data: [], error: null };
    if (chargesError) throw chargesError;
    const apps = (data ?? []).map((app) => {
      const rows = (charges ?? []).filter((charge) => charge.client_app_id === app.id);
      const approved = rows.filter((charge) => charge.status === 'approved');
      const pending = rows.filter((charge) => charge.status === 'pending');
      const latest = rows.reduce<string | null>((value, charge) => !value || charge.created_at > value ? charge.created_at : value, null);
      const business = app.businesses as unknown as { name: string } | null;
      const connection = app.payment_connections as unknown as { provider: string; status: string } | null;
      return {
        id: app.id, slug: app.slug, business_id: app.business_id, business_name: business?.name ?? null,
        connection_id: app.connection_id, connection_provider: connection?.provider ?? null, connection_status: connection?.status ?? null, connection_connected: Boolean(app.connection_id && connection?.status === "active"),
        allowed_origins: app.allowed_origins, deposit_default: app.deposit_default, item_title: app.item_title,
        active: app.active, metrics: { total: rows.length, approved: approved.length, pending: pending.length,
          approved_amount: approved.reduce((sum, charge) => sum + charge.amount, 0), latest_charge_at: latest },
      };
    });
    return NextResponse.json({ apps });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    const profile = authorize(await getSessionProfile(request));
    const raw: unknown = await request.json();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ScopeError('Ingresá datos válidos.', 400);
    const body = raw as Record<string, unknown>;
    const validated = validationSchemas.clientApp(body);
    if (!validated.ok) throw new ScopeError(Object.values(validated.fields)[0] ?? 'Ingresá datos válidos.', 400);
    if (!originsValid(body.allowed_origins)) throw new ScopeError('Los orígenes deben ser HTTPS o localhost, sin comodines ni duplicados.', 400);
    const db = getServiceClient();
    const { data: connection, error: connectionError } = await db.from('payment_connections').select('id').eq('id', validated.value.connection_id).eq('business_id', validated.value.business_id).maybeSingle();
    if (connectionError) throw connectionError;
    if (!connection) throw new ScopeError('La conexión no pertenece al negocio seleccionado.', 400);
    const apiKey = keyFor(String(validated.value.slug));
    const { data: app, error } = await db.from('client_apps').insert({
      slug: validated.value.slug, business_id: validated.value.business_id, connection_id: validated.value.connection_id,
      allowed_origins: body.allowed_origins, deposit_default: validated.value.deposit_default,
      item_title: validated.value.item_title, api_key_hash: createHash('sha256').update(apiKey).digest('hex'), active: true,
    }).select('id, slug, business_id, connection_id, allowed_origins, deposit_default, item_title, active').single();
    if (error) {
      if (error.code === '23505') throw new ScopeError('Ya existe una app con ese identificador.', 400);
      throw error;
    }
    await recordAuditEvent(db, { businessId: app.business_id, actorId: profile.userId, action: 'CONFIGURATION_UPDATED', entityType: 'client_app', entityId: app.id, newData: { slug: app.slug, active: app.active } });
    return NextResponse.json({ app, api_key: apiKey }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
