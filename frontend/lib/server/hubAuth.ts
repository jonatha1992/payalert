import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/server/session';
import { originAllowed, type ClientApp } from '@/lib/server/clientApps';

type AuthResult = { app: ClientApp; response: null } | { app: null; response: NextResponse };
type ApiKeyApp = ClientApp & { api_key_hash: string; active: boolean };

function unauthorized(): AuthResult {
  return { app: null, response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
}

function forbidden(): AuthResult {
  return { app: null, response: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
}

function hashesMatch(expected: string, actual: string): boolean {
  const expectedBytes = Buffer.from(expected, 'hex');
  const actualBytes = Buffer.from(actual, 'hex');
  return expectedBytes.length === actualBytes.length && expectedBytes.length > 0 && timingSafeEqual(expectedBytes, actualBytes);
}

export async function authenticateClientApp(request: Request): Promise<AuthResult> {
  const authorization = request.headers.get('authorization');
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);
  if (!match) return unauthorized();

  const apiKeyHash = createHash('sha256').update(match[1]).digest('hex');
  const { data, error } = await getServiceClient().from('client_apps').select('*')
    .eq('api_key_hash', apiKeyHash).eq('active', true).maybeSingle();
  if (error) throw error;
  const app = data as ApiKeyApp | null;
  if (!app || !app.active || !hashesMatch(apiKeyHash, app.api_key_hash)) return unauthorized();
  if (!originAllowed(app, request.headers.get('origin'))) return forbidden();
  return { app, response: null };
}
