import 'server-only';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const firebaseJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
export type FirebaseTokenResult =
  | { ok: true; uid: string; email: string }
  | { ok: false; reason: 'jwks_fetch_failed' | 'token_expired' | 'bad_signature' | 'wrong_audience' | 'wrong_issuer' | 'email_not_verified' | 'missing_email' | 'malformed' | 'unknown'; detail?: string };

export async function verifyFirebaseIdToken(token: string, projectId: string): Promise<FirebaseTokenResult> {
  try {
    const { payload } = await jwtVerify(token, firebaseJwks, { issuer: `https://securetoken.google.com/${projectId}`, audience: projectId });
    if (typeof payload.sub !== 'string' || !payload.sub) return { ok: false, reason: 'malformed' };
    if (payload.email_verified !== true) return { ok: false, reason: 'email_not_verified' };
    if (typeof payload.email !== 'string' || !payload.email) return { ok: false, reason: 'missing_email' };
    return { ok: true, uid: payload.sub, email: payload.email.toLowerCase() };
  } catch (error) {
    const e = error as { code?: string; claim?: string; message?: string };
    const detail = e.code;
    if (e.code === 'ERR_JWT_EXPIRED') return { ok: false, reason: 'token_expired', detail };
    if (e.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') return { ok: false, reason: 'bad_signature', detail };
    if (e.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') return { ok: false, reason: e.claim === 'aud' ? 'wrong_audience' : e.claim === 'iss' ? 'wrong_issuer' : 'malformed', detail };
    if (e.code?.startsWith('ERR_JWKS_')) return { ok: false, reason: 'jwks_fetch_failed', detail };
    if (e.code === 'ERR_JWS_INVALID' || e.code === 'ERR_JWT_INVALID') return { ok: false, reason: 'malformed', detail };
    console.warn('[firebaseIdToken] verificacion desconocida', { code: e.code, message: e.message?.slice(0, 160) });
    return { ok: false, reason: 'unknown', detail };
  }
}
