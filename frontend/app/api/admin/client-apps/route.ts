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

function originsValid(input: unknown, allowEmpty = false): input is string[] {
  return Array.isArray(input) && (allowEmpty || input.length > 0) && input.every((origin) =>
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
    const { data, error } = await db.from('client_apps').select('id, slug, business_id, connection_id, allowed_origins, deposit_default, item_title, active, created_at, businesses(name), payment_connections(provider, status), firebase_project_id, owner_emails, fee_type, fee_value').order('created_at', { ascending: false });
    if (error) throw error;
    const ids = (data ?? []).map((app) => app.id);
    const { data: charges, error: chargesError } = ids.length
      ? await db.from('hub_charges').select('client_app_id, amount, status, created_at').in('client_app_id', ids)
      : { data: [], error: null };
    if (chargesError) throw chargesError;
    const connectionIds = [...new Set((data ?? []).map((app) => app.connection_id).filter((id): id is string => Boolean(id)))];
    const { data: connectionRows, error: connectionError } = connectionIds.length
      ? await db.from('payment_connections').select('id, provider, status, provider_account_id, label').in('id', connectionIds)
      : { data: [], error: null };
    if (connectionError) throw connectionError;
    const connectionsById = new Map((connectionRows ?? []).map((connection) => [connection.id, { ...connection, mp_nickname: null as string | null, mp_email: null as string | null }]));
    const { data: auditLogs, error: auditError } = ids.length
      ? await db.from('audit_logs').select('entity_id, created_at, new_data').eq('action', 'browser_connect_link').in('entity_id', ids).order('created_at', { ascending: false })
      : { data: [], error: null };
    if (auditError) console.warn('[Admin client apps] connect attempt history unavailable:', auditError.message);
    const attemptsByApp = new Map<string, { created_at: string; status: string | null; code: string | null }>();
    for (const log of auditLogs ?? []) {
      if (attemptsByApp.has(log.entity_id)) continue;
      const auditData = log.new_data as { status?: unknown; code?: unknown } | null;
      attemptsByApp.set(log.entity_id, { created_at: log.created_at, status: typeof auditData?.status === 'number' || typeof auditData?.status === 'string' ? String(auditData.status) : null, code: typeof auditData?.code === 'string' ? auditData.code : null });
    }
    const apps = (data ?? []).map((app) => {
      const rows = (charges ?? []).filter((charge) => charge.client_app_id === app.id);
      const approved = rows.filter((charge) => charge.status === 'approved');
      const pending = rows.filter((charge) => charge.status === 'pending');
      const latest = rows.reduce<string | null>((value, charge) => !value || charge.created_at > value ? charge.created_at : value, null);
      const business = app.businesses as unknown as { name: string } | null;
      const connection = (app.connection_id ? connectionsById.get(app.connection_id) : undefined);
      const feeType = app.fee_type as 'fixed' | 'percent' | null;
      const feeValue = app.fee_value as number | null;
      return {
        id: app.id, slug: app.slug, name: business?.name?.startsWith('app:') ? app.slug.split('-').map((part: string) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') : business?.name ?? app.slug, business_id: app.business_id, business_name: business?.name ?? null,
        connection_id: app.connection_id, connection_provider: connection?.provider ?? null, connection_status: connection?.status ?? null, connection_connected: Boolean(app.connection_id && ['connected','active'].includes(connection?.status?.toLowerCase() ?? '')),
        payment_account: connection ? { account_id: connection.provider_account_id, nickname: connection.mp_nickname, email: connection.mp_email, label: connection.label } : null,
        last_connect_attempt: attemptsByApp.get(app.id) ?? null,
        allowed_origins: app.allowed_origins, deposit_default: app.deposit_default, item_title: app.item_title, firebase_project_id: app.firebase_project_id ?? null, owner_emails: app.owner_emails ?? [], fee_type: feeType, fee_value: feeValue,
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
    if (!validated.ok) throw new ScopeError(Object.values(validated.fields)[0] ?? 'Ingresá un nombre válido.', 400);
    const normalizedName = String(validated.value.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const slug = normalizedName.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!slug || slug.length > 50 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new ScopeError('El nombre debe generar un identificador válido con letras y números.', 400);
    const db = getServiceClient();
    const businessName = 'app:' + slug;
    let businessId: string | undefined;
    const { data: existingBusiness, error: businessLookupError } = await db.from('businesses').select('id').eq('name', businessName).maybeSingle();
    if (businessLookupError?.code === '23505') {
      const { data: racedBusiness, error: racedLookupError } = await db.from('businesses').select('id').eq('name', businessName).single();
      if (racedLookupError) throw racedLookupError;
      businessId = racedBusiness.id;
    } else if (businessLookupError) throw businessLookupError;
    else businessId = existingBusiness?.id;
    if (!businessId) {
      const { data: createdBusiness, error: businessCreateError } = await db.from('businesses').insert({ name: businessName }).select('id').single();
      if (businessCreateError?.code === '23505') {
        const { data: racedBusiness, error: racedLookupError } = await db.from('businesses').select('id').eq('name', businessName).single();
        if (racedLookupError) throw racedLookupError;
        businessId = racedBusiness.id;
      } else if (businessCreateError) throw businessCreateError;
      else businessId = createdBusiness.id;
    }
    const connectionId = body.connection_id === undefined || body.connection_id === null || body.connection_id === '' ? null : body.connection_id;
    if (connectionId !== null) {
      if (typeof connectionId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(connectionId)) throw new ScopeError('Ingresá una conexión válida.', 400);
      const { data: connection, error: connectionError } = await db.from('payment_connections').select('id').eq('id', connectionId).eq('business_id', businessId).maybeSingle();
      if (connectionError) throw connectionError;
      if (!connection) throw new ScopeError('La conexión no pertenece al negocio seleccionado.', 400);
    }
    const allowedOrigins = body.allowed_origins === undefined ? [] : body.allowed_origins;
    if (!originsValid(allowedOrigins, true)) throw new ScopeError('Los orígenes deben ser HTTPS o localhost, sin comodines ni duplicados.', 400);
    const depositDefault = body.deposit_default === undefined ? 5000 : body.deposit_default;
    const validatedAmount = validationSchemas.clientAppAmount({ deposit_default: depositDefault });
    if (!validatedAmount.ok) throw new ScopeError('El monto debe ser un entero entre 1 y 1.000.000.', 400);
    const itemTitle = body.item_title === undefined ? 'Seña' : body.item_title;
    const validatedTitle = validationSchemas.clientAppTitle({ item_title: itemTitle });
    if (!validatedTitle.ok) throw new ScopeError('El título no puede superar los 120 caracteres.', 400);
    const apiKey = keyFor(slug);
    const { data: app, error } = await db.from('client_apps').insert({
      slug, business_id: businessId, connection_id: connectionId,
      allowed_origins: allowedOrigins, deposit_default: validatedAmount.value.deposit_default,
      item_title: validatedTitle.value.item_title, api_key_hash: createHash('sha256').update(apiKey).digest('hex'), active: true,
    }).select('id, slug, business_id, connection_id, allowed_origins, deposit_default, item_title, active').single();
    if (error) {
      if (error.code === '23505') throw new ScopeError('Ya existe una app con ese identificador.', 400);
      throw error;
    }
    await recordAuditEvent(db, { businessId: app.business_id, actorId: profile.userId, action: 'CONFIGURATION_UPDATED', entityType: 'client_app', entityId: app.id, newData: { slug: app.slug, active: app.active } });
    return NextResponse.json({ app, api_key: apiKey }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
