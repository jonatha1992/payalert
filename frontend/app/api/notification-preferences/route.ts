import { NextRequest, NextResponse } from 'next/server';
import { getNotificationPreferences, updateNotificationPreferences } from '@/lib/server/notificationPreferences';
import { resolveScope } from '@/lib/server/scope';
import { getSessionProfile, scopeErrorResponse } from '@/lib/server/session';
import { withRateLimit } from '@/lib/security/withRateLimit';
import { apiRateLimiter } from '@/lib/security/rateLimiter';

async function getPreferencesHandler(request: NextRequest) {
  try {
    const scope = resolveScope(await getSessionProfile(request), {
      businessId: request.nextUrl.searchParams.get('businessId'),
    });
    const prefs = await getNotificationPreferences(scope);
    return NextResponse.json({ preferences: prefs });
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    console.error('[NotificationPrefs] get failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'No pudimos cargar las preferencias.' }, { status: 500 });
  }
}

async function updatePreferencesHandler(request: NextRequest) {
  try {
    const profile = await getSessionProfile(request);
    const scope = resolveScope(profile, { businessId: request.nextUrl.searchParams.get('businessId') });
    const body = (await request.json()) as Partial<{ pushEnabled: boolean; soundEnabled: boolean; emailEnabled: boolean }>;
    const prefs = await updateNotificationPreferences(scope, body);
    return NextResponse.json({ preferences: prefs });
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    console.error('[NotificationPrefs] update failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'No pudimos actualizar las preferencias.' }, { status: 500 });
  }
}

export const GET = withRateLimit(getPreferencesHandler, { limiter: apiRateLimiter });
export const PATCH = withRateLimit(updatePreferencesHandler, { limiter: apiRateLimiter });