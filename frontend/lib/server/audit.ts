import type { SupabaseClient } from '@supabase/supabase-js';

export type AuditAction = 'USER_CREATED' | 'USER_DELETED' | 'USER_ROLE_CHANGED' | 'CONFIGURATION_UPDATED' | 'MANUAL_RESOLUTION' | 'LOGIN' | 'LOGOUT' | 'browser_connect_link' | 'client_app_deleted' | 'client_app_archived';

/** Audit payloads intentionally contain identifiers and action metadata only, never submitted user data or network addresses. */
export async function recordAuditEvent(db: SupabaseClient, event: {
  businessId: string | null;
  actorId: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  newData?: Record<string, unknown> | null;
}): Promise<void> {
  const { error } = await db.from('audit_logs').insert({
    business_id: event.businessId,
    user_id: event.actorId,
    action: event.action,
    entity_type: event.entityType,
    entity_id: event.entityId ?? null,
    new_data: event.newData ?? null,
  });
  if (error) throw error;
}
