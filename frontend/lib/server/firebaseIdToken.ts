import 'server-only';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const firebaseJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));

export async function verifyFirebaseIdToken(token: string, projectId: string): Promise<{ uid: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, firebaseJwks, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    if (typeof payload.sub !== 'string' || !payload.sub || payload.email_verified !== true || typeof payload.email !== 'string') return null;
    return { uid: payload.sub, email: payload.email.toLowerCase() };
  } catch {
    return null;
  }
}
