import 'server-only';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const firebaseJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));

export async function verifyFirebaseIdToken(token: string, projectId: string): Promise<{ uid: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, firebaseJwks, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    if (typeof payload.sub !== 'string' || !payload.sub || payload.email_verified !== true || typeof payload.email !== 'string') { console.warn('[firebaseIdToken] claims rechazados', { aud: payload.aud, email_verified: payload.email_verified, has_email: typeof payload.email === 'string' }); return null; }
    return { uid: payload.sub, email: payload.email.toLowerCase() };
  } catch (error) {
    console.warn('[firebaseIdToken] verificacion fallida', { code: (error as { code?: string })?.code, message: (error as Error)?.message?.slice(0, 160), projectId });
    return null;
  }
}
