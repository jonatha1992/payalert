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
  return Array.isArray(input) && (allowEmpty || input.length > 0) && input.every((origin) => typeof origin === 'string' && !origin.includes('*') && (/^https:\/\/[^/\s]+(?::\d+)?$/.test(origin) || /^http:\/\/localhost(?::\d+)?$/.test(origin))) && new Set(input).size === input.length;
}

function responseError(error: unknown) {
  if (error instanceof ScopeError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error('[Admin client app] update failed:', error instanceof Error ? error.message : 'unknown');
  return NextResponse.json({ error: 'No pudimos actualizar la app vinculada.' }, { status: 500 });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const profile = authorize(await getSessionProfile(request));
    const { id } = await context.params;
    const raw: unknown = await request.json();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ScopeError('Ingresá datos válidos.', 400);
    const body = raw as Record<string, unknown>;
    const db = getServiceClient();
    const { data: existing, error: lookupError } = await db.from('client_apps').select('id, slug, business_id').eq('id', id).maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) throw new ScopeError('App vinculada no encontrada.', 400);

    if (body.action === 'rotateKey') {
      const apiKey = `pa_${existing.slug}_${randomBytes(32).toString('base64url')}`;
      const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');
      const { error } = await db.from('client_apps').update({ api_key_hash: apiKeyHash, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      await recordAuditEvent(db, { businessId: existing.business_id, actorId: profile.userId, action: 'CONFIGURATION_UPDATED', entityType: 'client_app_key', entityId: id });
      return NextResponse.json({ api_key: apiKey });
    }

    const changes: Record<string, unknown> = {};
    if (body.active !== undefined) {
      if (typeof body.active !== 'boolean') throw new ScopeError('El estado debe ser activo o pausado.', 400);
      changes.active = body.active;
    }
    if (body.allowed_origins !== undefined) {
      if (!originsValid(body.allowed_origins, true)) throw new ScopeError('Los orígenes deben ser HTTPS o localhost, sin comodines ni duplicados.', 400);
      changes.allowed_origins = body.allowed_origins;
    }
    if (body.deposit_default !== undefined) {
      const result = validationSchemas.clientAppAmount({ deposit_default: body.deposit_default });
      if (!result.ok) throw new ScopeError('El monto debe ser un entero entre 1 y 1.000.000.', 400);
      changes.deposit_default = result.value.deposit_default;
    }
    if (body.item_title !== undefined) {
      const result = validationSchemas.clientAppTitle({ item_title: body.item_title });
      if (!result.ok) throw new ScopeError('El título no puede superar los 120 caracteres.', 400);
      changes.item_title = result.value.item_title;
    }
    if (body.fee_type !== undefined || body.fee_value !== undefined) {
      const feeType = body.fee_type ?? 'fixed';
      const feeValue = body.fee_value ?? 1;
      const result = validationSchemas.clientAppFee({ fee_type: feeType, fee_value: feeValue });
      if (!result.ok) throw new ScopeError(result.fields.fee_value ?? result.fields.fee_type ?? 'La comisión no es válida.', 400);
      if (result.value.fee_type === 'percent' && Number(result.value.fee_value) > 50) throw new ScopeError('El porcentaje debe estar entre 0 y 50.', 400);
      changes.fee_type = result.value.fee_type;
      changes.fee_value = result.value.fee_value;
    }
    if (body.firebase_project_id !== undefined || body.owner_emails !== undefined) {
      const result = validationSchemas.clientAppFirebase({ firebase_project_id: body.firebase_project_id, owner_emails: body.owner_emails });
      if (!result.ok) throw new ScopeError(Object.values(result.fields)[0] ?? 'La configuración Firebase no es válida.', 400);
      if (body.firebase_project_id !== undefined) changes.firebase_project_id = result.value.firebase_project_id;
      if (body.owner_emails !== undefined) changes.owner_emails = result.value.owner_emails;
    }
    if (!Object.keys(changes).length) throw new ScopeError('No hay cambios válidos para guardar.', 400);
    changes.updated_at = new Date().toISOString();
    const { data: app, error } = await db.from('client_apps').update(changes).eq('id', id).select('id, slug, business_id, connection_id, allowed_origins, deposit_default, item_title, active, firebase_project_id, owner_emails').single();
    if (error) throw error;
    await recordAuditEvent(db, { businessId: existing.business_id, actorId: profile.userId, action: 'CONFIGURATION_UPDATED', entityType: 'client_app', entityId: id, newData: { ...changes, allowed_origins: changes.allowed_origins ? '[actualizados]' : undefined } });
    return NextResponse.json({ app });
  } catch (error) { return responseError(error); }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const profile = authorize(await getSessionProfile(request));
    const { id } = await context.params;
    const db = getServiceClient();
    const { data: app, error: lookupError } = await db.from('client_apps').select('id, business_id').eq('id', id).maybeSingle();
    if (lookupError) throw lookupError;
    if (!app) return NextResponse.json({ error: 'App no encontrada', code: 'not_found' }, { status: 404 });

    const { data: charges, error: chargesError } = await db.from('hub_charges').select('id').eq('client_app_id', id);
    if (chargesError) throw chargesError;
    if ((charges ?? []).length > 0) {
      const { error } = await db.from('client_apps').update({ active: false }).eq('id', id);
      if (error) throw error;
      try { await recordAuditEvent(db, { businessId: app.business_id, actorId: profile.userId, action: 'client_app_archived', entityType: 'client_app', entityId: id }); } catch (auditError) { console.error('[Admin client app] audit failed:', auditError instanceof Error ? auditError.message : 'unknown'); }
      return NextResponse.json({ archived: true });
    }

    const { error: inviteError } = await db.from('connect_invites').delete().eq('client_app_id', id);
    if (inviteError) throw inviteError;
    const { error: deleteError } = await db.from('client_apps').delete().eq('id', id);
    if (deleteError) throw deleteError;
    try { await recordAuditEvent(db, { businessId: app.business_id, actorId: profile.userId, action: 'client_app_deleted', entityType: 'client_app', entityId: id }); } catch (auditError) { console.error('[Admin client app] audit failed:', auditError instanceof Error ? auditError.message : 'unknown'); }
    return NextResponse.json({ deleted: true });
  } catch (error) { return responseError(error); }
}
