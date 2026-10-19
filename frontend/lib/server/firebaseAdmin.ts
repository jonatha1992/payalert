import 'server-only';
import { createHash } from 'node:crypto';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { decryptSecret } from '@/lib/payments/secretBox';
import type { ClientApp } from '@/lib/server/clientApps';

const cache = new Map<string, App>();
export function firebaseForClientApp(app: ClientApp) {
  const credentialHash = createHash('sha256').update(app.firebase_sa_encrypted).digest('hex');
  const cacheKey = app.firebase_project_id + ':' + credentialHash;
  let admin = cache.get(cacheKey);
  if (!admin) {
    const serviceAccount = JSON.parse(decryptSecret(app.firebase_sa_encrypted)) as Record<string, string>;
    admin = getApps().find((candidate) => candidate.options.projectId === app.firebase_project_id)
      ?? initializeApp({ credential: cert(serviceAccount), projectId: app.firebase_project_id }, app.firebase_project_id);
    cache.set(cacheKey, admin);
  }
  return { auth: getAuth(admin), firestore: getFirestore(admin) };
}
