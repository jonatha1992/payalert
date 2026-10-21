import { NextRequest, NextResponse } from 'next/server';
import { getSessionProfile, getServiceClient, assertStoreInBusiness } from '@/lib/server/session';
import { ScopeError } from '@/lib/server/scope';
import { recordAuditEvent } from '@/lib/server/audit';
import { validationSchemas } from '@/lib/validation/schemas';

type Body = { systemRole: 'admin' | 'user'; businessRole?: 'owner' | 'employee'; business_id?: string; assigned_store_id?: string; confirmAdmin?: true };

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const profile = await getSessionProfile(request);
    if (!profile) throw new ScopeError('No autenticado', 401);
    if (profile.role !== 'admin') throw new ScopeError('Permiso insuficiente', 403);
    const bodyUnknown: unknown = await request.json();
    const validation = validationSchemas.adminUserRole(bodyUnknown);
    if (!validation.ok) return NextResponse.json({ error: 'Datos inválidos', fields: validation.fields }, { status: 400 });
    const body = validation.value as Body;
    const { id } = await context.params;
    if (id === profile.userId && body.systemRole !== 'admin') return NextResponse.json({ error: 'No podés quitarte el rol de administrador.' }, { status: 409 });
    if (id === profile.userId) return NextResponse.json({ error: 'No podés modificar tu propia asignación de roles.' }, { status: 409 });
    const db = getServiceClient();
    const { data: target, error: targetError } = await db.from('users').select('id,role,business_id,assigned_store_id').eq('id', id).maybeSingle();
    if (targetError) throw targetError;
    if (!target) return NextResponse.json({ error: 'No encontramos ese usuario.' }, { status: 404 });
    if (target.role === 'admin' && body.systemRole !== 'admin') {
      const { count, error } = await db.from('users').select('id', { count: 'exact', head: true }).eq('role', 'admin');
      if (error) throw error;
      if (count !== null && count <= 1) return NextResponse.json({ error: 'No se puede quitar el último administrador del sistema.' }, { status: 409 });
    }
    let role: 'admin' | 'owner' | 'employee';
    let businessId: string | null = null;
    let storeId: string | null = null;
    if (body.systemRole === 'admin') {
      if (body.confirmAdmin !== true) return NextResponse.json({ error: 'Confirmá el cambio a administrador del sistema.' }, { status: 400 });
      role = 'admin';
    } else {
      if (!body.businessRole || !body.business_id) return NextResponse.json({ error: 'Seleccioná el rol y el negocio.' }, { status: 400 });
      role = body.businessRole;
      businessId = body.business_id;
      if (role === 'employee') {
      if (!body.assigned_store_id) return NextResponse.json({ error: 'El empleado debe tener una sucursal asignada.' }, { status: 400 });
      try { await assertStoreInBusiness(body.assigned_store_id, businessId); }
      catch (error) {
        if (error instanceof ScopeError) return NextResponse.json({ error: error.message }, { status: error.status });
        return NextResponse.json({ error: 'La sucursal no pertenece al negocio seleccionado.' }, { status: 400 });
      }
      storeId = body.assigned_store_id;
      }
    }
    const { data: updated, error } = await db.from('users').update({ role, business_id: businessId, assigned_store_id: storeId }).eq('id', id).select('id,role,business_id,assigned_store_id').single();
    if (error) throw error;
    await recordAuditEvent(db, { businessId, actorId: profile.userId, action: 'USER_ROLE_CHANGED', entityType: 'user', entityId: id, newData: { previous_role: target.role, role, previous_business_id: target.business_id, business_id: businessId, previous_assigned_store_id: target.assigned_store_id, assigned_store_id: storeId } });
    return NextResponse.json({ user: updated });
  } catch (error) {
    if (error instanceof ScopeError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[Admin users] role update failed');
    return NextResponse.json({ error: 'No pudimos actualizar el rol del usuario.' }, { status: 500 });
  }
}
