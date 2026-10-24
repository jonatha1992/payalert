import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { apiKeyHash, createInviteToken, getOrCreateBusiness, inviteUrl, parseHours, validateConfig } = require('../../../scripts/register-client-app.js');
import { createConnectInvite, inviteTokenHash } from '../../lib/server/connectInvites';
const config = { slug: 'shop', business_id: 'business-1', connection_id: 'connection-1', allowed_origins: ['https://shop.test'], deposit_default: 2500 };

describe('register-client-app generic mode', () => {
  it('uses the same SHA-256 hex digest as hub authentication', () => { expect(apiKeyHash('pa_test-key')).toBe(createHash('sha256').update('pa_test-key').digest('hex')); });
  it('accepts generic app config without Firebase or admin fields', () => { expect(() => validateConfig(config)).not.toThrow(); });
  it('generates a prefixed 32-byte base64url key and stores only its digest', () => {
    const source = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../scripts/register-client-app.js'), 'utf8');
    expect(source).toContain("'pa_' + randomBytes(32).toString('base64url')");
    expect(source).toContain('api_key_hash: hash');
    expect(source).not.toContain('firebase_service_account_file');
    expect(source).not.toContain('firebase_sa_encrypted');
  });
  it('creates a random invite token, hashes the token and builds its complete URL', async () => {
    const token = 'ci_sample';
    expect(inviteTokenHash(token)).toBe(createHash('sha256').update(token).digest('hex'));
    const inserted: unknown[] = [];
    await createConnectInvite({ from: () => ({ insert: async (row) => { inserted.push(row); return { error: null }; } }) }, { id: 'app-1' }, { hours: 1, baseUrl: 'https://payalert.test/', now: new Date('2030-01-01T00:00:00Z') });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ client_app_id: 'app-1', expires_at: '2030-01-01T01:00:00.000Z' });
    expect(inviteUrl(token, 'https://payalert.test/')).toBe(`https://payalert.test/connect/${token}`);
  });
  it('validates invite lifetime and safe client return origins', () => {
    expect(parseHours('24')).toBe(24);
    expect(() => parseHours('0')).toThrow('--hours');
    expect(() => validateConfig({ ...config, connect_return_url: 'https://attacker.test/return' })).toThrow('allowed_origins');
  });
  it('allows connection-free configs and rejects invalid optional identifiers and deposits', () => {
    expect(() => validateConfig({ slug: 'shop', allowed_origins: ['https://shop.test'] })).not.toThrow();
    expect(() => validateConfig({ ...config, connection_id: '' })).toThrow('connection_id is required');
    expect(() => validateConfig({ ...config, deposit_default: 0 })).toThrow('deposit_default');
    expect(() => validateConfig({ ...config, connect_return_url: 'http://shop.test/return' })).toThrow('https');
  });
  it('creates or reuses the hidden business keyed by app slug', async () => {
    const calls: string[] = [];
    const db = { from: (table: string) => ({ select: (columns: string) => { calls.push(`${table}.select(${columns})`); return { eq: (field: string, value: string) => { calls.push(`${field}=${value}`); return { maybeSingle: async () => ({ data: null, error: null }) }; } }; }, insert: (row: { name: string }) => { calls.push(`${table}.insert(${row.name})`); return { select: () => ({ single: async () => ({ data: { id: 'new-business' }, error: null }) }) }; } }) };
    await expect(getOrCreateBusiness(db as never, 'shop')).resolves.toBe('new-business');
    expect(calls).toContain('businesses.insert(app:shop)');
    await expect(getOrCreateBusiness({} as never, 'shop', 'provided')).resolves.toBe('provided');
  });
});
