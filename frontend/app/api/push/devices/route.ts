import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveScope } from '@/lib/server/scope';
import { getSessionProfile, getServiceClient, scopeErrorResponse } from '@/lib/server/session';
import { withRateLimit } from '@/lib/security/withRateLimit';
import { apiRateLimiter } from '@/lib/security/rateLimiter';
import { logStructured } from '@/lib/server/structuredLog';

const deviceSchema = z.object({
  platform: z.enum(['ios', 'android']),
  expoPushToken: z.string().min(1).max(512).regex(/^(ExponentPushToken|ExpoPushToken)\[[^\]\s]+\]$/),
  deviceLabel: z.string().trim().max(120).nullable().optional(),
});
const revokeSchema = z.object({ expoPushToken: deviceSchema.shape.expoPushToken });

async function postDevice(request: NextRequest) {
  try {
    const profile = await getSessionProfile(request);
    const scope = resolveScope(profile, {});
    const parsed = deviceSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Dispositivo inválido.' }, { status: 400 });
    const now = new Date().toISOString();
    const { error } = await getServiceClient().from('device_push_tokens').upsert({ business_id: scope.businessId,
      user_id: scope.userId, platform: parsed.data.platform, expo_push_token: parsed.data.expoPushToken,
      device_label: parsed.data.deviceLabel ?? null, last_seen_at: now, revoked_at: null }, { onConflict: 'expo_push_token' });
    if (error) throw error;
    logStructured('push_device_registered', { userId: scope.userId, businessId: scope.businessId, platform: parsed.data.platform });
    return NextResponse.json({ success: true });
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    logStructured('push_device_registration_failed');
    return NextResponse.json({ error: 'No pudimos registrar el dispositivo.' }, { status: 500 });
  }
}

async function deleteDevice(request: NextRequest) {
  try {
    const profile = await getSessionProfile(request);
    const scope = resolveScope(profile, {});
    const parsed = revokeSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Token inválido.' }, { status: 400 });
    const { error } = await getServiceClient().from('device_push_tokens').update({ revoked_at: new Date().toISOString() })
      .eq('expo_push_token', parsed.data.expoPushToken).eq('user_id', scope.userId).eq('business_id', scope.businessId).is('revoked_at', null);
    if (error) throw error;
    logStructured('push_device_revoked', { userId: scope.userId, businessId: scope.businessId });
    return NextResponse.json({ success: true });
  } catch (error) {
    const denied = scopeErrorResponse(error);
    if (denied) return denied;
    logStructured('push_device_revocation_failed');
    return NextResponse.json({ error: 'No pudimos dar de baja el dispositivo.' }, { status: 500 });
  }
}

export const POST = withRateLimit(postDevice, { limiter: apiRateLimiter });
export const DELETE = withRateLimit(deleteDevice, { limiter: apiRateLimiter });
