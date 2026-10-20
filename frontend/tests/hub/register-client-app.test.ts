import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const { apiKeyHash, validateConfig } = require('../../../scripts/register-client-app.js');

const config = { slug: 'shop', business_id: 'business-1', connection_id: 'connection-1', allowed_origins: ['https://shop.test'], deposit_default: 2500 };

describe('register-client-app generic mode', () => {
  it('uses the same SHA-256 hex digest as hub authentication', () => {
    expect(apiKeyHash('pa_test-key')).toBe(createHash('sha256').update('pa_test-key').digest('hex'));
  });

  it('accepts generic app config without Firebase or admin fields', () => {
    expect(() => validateConfig(config)).not.toThrow();
  });

  it('generates a prefixed 32-byte base64url key and stores only its digest', () => {
    const source = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../scripts/register-client-app.js'), 'utf8');
    expect(source).toContain("'pa_' + randomBytes(32).toString('base64url')");
    expect(source).toContain('api_key_hash: hash');
    expect(source).not.toContain('firebase_service_account_file');
    expect(source).not.toContain('firebase_sa_encrypted');
  });

  it('requires a connection and rejects an invalid deposit', () => {
    expect(() => validateConfig({ ...config, connection_id: '' })).toThrow('connection_id is required');
    expect(() => validateConfig({ ...config, deposit_default: 0 })).toThrow('deposit_default');
  });
});
