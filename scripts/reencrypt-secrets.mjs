#!/usr/bin/env node
import { createRequire } from 'node:module';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey, PAYMENTS_ENCRYPTION_KEY: activeKey, PAYMENTS_ENCRYPTION_KEY_ID: activeId = 'default', PAYMENTS_ENCRYPTION_KEYS: keyJson } = process.env;
if (!url || !serviceKey || !activeKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or PAYMENTS_ENCRYPTION_KEY');
  process.exit(1);
}
const dryRun = process.argv.includes('--dry-run');
const keys = new Map([[activeId, activeKey], ['legacy', activeKey]]);
try {
  if (keyJson) for (const [id, key] of Object.entries(JSON.parse(keyJson))) keys.set(id, key);
} catch { console.error('PAYMENTS_ENCRYPTION_KEYS must be a JSON object'); process.exit(1); }
const decodeKey = (base64, name) => {
  const key = Buffer.from(base64, 'base64');
  if (key.length !== 32) throw new Error(`${name} must be 32 bytes encoded as base64`);
  return key;
};
function decrypt(value) {
  const parts = value.split(':');
  if (parts[0] !== 'enc') throw new Error('Refusing to rewrite a plaintext secret');
  let id, iv, tag, ciphertext;
  if (parts[1] === 'v1' && parts.length === 5) [id, , iv, tag, ciphertext] = ['legacy', ...parts];
  else if (parts[1] === 'v2' && parts.length === 6) [, , id, iv, tag, ciphertext] = parts;
  else throw new Error('Unsupported or malformed encrypted secret');
  const keyB64 = keys.get(id);
  if (!keyB64) throw new Error(`Missing decryption key id ${id}`);
  const decipher = createDecipheriv('aes-256-gcm', decodeKey(keyB64, id), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
}
function encrypt(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', decodeKey(activeKey, 'PAYMENTS_ENCRYPTION_KEY'), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['enc', 'v2', activeId, iv.toString('base64'), cipher.getAuthTag().toString('base64'), ciphertext.toString('base64')].join(':');
}
const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const client = createClient(url, serviceKey, { auth: { persistSession: false } });
let scanned = 0;
let changed = 0;
for (const column of ['credentials_encrypted', 'webhook_secret_encrypted']) {
  const { data, error } = await client.from('payment_connections').select(`id, ${column}`).not(column, 'is', null);
  if (error) throw error;
  for (const row of data ?? []) {
    scanned += 1;
    const sealed = row[column];
    if (sealed.startsWith(`enc:v2:${activeId}:`)) continue;
    const updated = encrypt(decrypt(sealed));
    changed += 1;
    if (!dryRun) {
      const { error: updateError } = await client.from('payment_connections').update({ [column]: updated }).eq('id', row.id);
      if (updateError) throw updateError;
    }
  }
}
console.log(JSON.stringify({ dryRun, scanned, wouldReencrypt: changed, reencrypted: dryRun ? 0 : changed }));
