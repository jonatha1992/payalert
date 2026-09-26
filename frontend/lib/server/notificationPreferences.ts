// Server-only module: user notification preferences.
import { getServiceClient } from '@/lib/server/session';
import { ScopeError, type ResolvedScope } from '@/lib/server/scope';

export interface NotificationPreferences {
  userId: string;
  businessId: string;
  pushEnabled: boolean;
  soundEnabled: boolean;
  emailEnabled: boolean;
  updatedAt: string;
}

const DEFAULT_PREFS: Omit<NotificationPreferences, 'userId' | 'businessId' | 'updatedAt'> = {
  pushEnabled: true,
  soundEnabled: true,
  emailEnabled: false,
};

async function getPrefsRow(scope: ResolvedScope): Promise<NotificationPreferences | null> {
  const { data, error } = await getServiceClient()
    .from('user_notification_preferences')
    .select('user_id, business_id, push_enabled, sound_enabled, email_enabled, updated_at')
    .eq('user_id', scope.userId)
    .eq('business_id', scope.businessId)
    .maybeSingle<NotificationPreferences>();
  if (error) throw error;
  return data;
}

export async function getNotificationPreferences(scope: ResolvedScope): Promise<NotificationPreferences> {
  const row = await getPrefsRow(scope);
  if (row) return row;
  // Return defaults without persisting until explicitly saved
  return {
    userId: scope.userId,
    businessId: scope.businessId,
    ...DEFAULT_PREFS,
    updatedAt: new Date().toISOString(),
  };
}

export async function updateNotificationPreferences(
  scope: ResolvedScope,
  input: Partial<Pick<NotificationPreferences, 'pushEnabled' | 'soundEnabled' | 'emailEnabled'>>
): Promise<NotificationPreferences> {
  const now = new Date().toISOString();
  const existing = await getPrefsRow(scope);
  const prefs: NotificationPreferences = {
    userId: scope.userId,
    businessId: scope.businessId,
    pushEnabled: input.pushEnabled ?? existing?.pushEnabled ?? DEFAULT_PREFS.pushEnabled,
    soundEnabled: input.soundEnabled ?? existing?.soundEnabled ?? DEFAULT_PREFS.soundEnabled,
    emailEnabled: input.emailEnabled ?? existing?.emailEnabled ?? DEFAULT_PREFS.emailEnabled,
    updatedAt: now,
  };

  const { error } = await getServiceClient()
    .from('user_notification_preferences')
    .upsert({
      user_id: prefs.userId,
      business_id: prefs.businessId,
      push_enabled: prefs.pushEnabled,
      sound_enabled: prefs.soundEnabled,
      email_enabled: prefs.emailEnabled,
      updated_at: now,
    }, { onConflict: 'user_id,business_id' });
  if (error) throw error;

  // Audit log
  await getServiceClient().from('audit_logs').insert({
    business_id: scope.businessId,
    user_id: scope.userId,
    action: 'NOTIFICATION_PREFS_UPDATED',
    entity_type: 'notification_preferences',
    entity_id: scope.userId + ':' + scope.businessId,
    new_data: { pushEnabled: prefs.pushEnabled, soundEnabled: prefs.soundEnabled, emailEnabled: prefs.emailEnabled },
    old_data: existing ? { pushEnabled: existing.pushEnabled, soundEnabled: existing.soundEnabled, emailEnabled: existing.emailEnabled } : null,
  });

  return prefs;
}