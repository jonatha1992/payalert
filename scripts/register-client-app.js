#!/usr/bin/env node
const crypto = require('node:crypto');
const { createHash, randomBytes } = crypto;
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const frontendRequire = createRequire(path.resolve(__dirname, '../frontend/package.json'));
function required(value, name) { if (typeof value !== 'string' || value.trim() === '') throw new Error(name + ' is required'); return value; }
function apiKeyHash(apiKey) { return createHash('sha256').update(apiKey).digest('hex'); }
function validateConfig(config) {
  for (const key of ['slug', 'business_id', 'connection_id']) required(config[key], key);
  if (!Array.isArray(config.allowed_origins) || config.allowed_origins.some((origin) => typeof origin !== 'string' || origin.trim() === '')) throw new Error('allowed_origins must be an array of non-empty strings');
  if (config.deposit_default !== undefined && (!Number.isInteger(config.deposit_default) || config.deposit_default < 1 || config.deposit_default > 1_000_000)) throw new Error('deposit_default must be an integer from 1 to 1000000');
}
async function main() {
  const args = process.argv.slice(2);
  const dryRunIndex = args.indexOf('--dry-run');
  if (dryRunIndex !== -1) args.splice(dryRunIndex, 1);
  const filename = args[0];
  if (!filename || args.length !== 1) throw new Error('Usage: node scripts/register-client-app.js [--dry-run] <local-config.json>');
  const configPath = path.resolve(filename);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  validateConfig(config);
  if (dryRunIndex !== -1) {
    console.log(JSON.stringify({ valid: true, slug: config.slug, business_id: config.business_id, connection_id: config.connection_id, allowed_origins: config.allowed_origins, deposit_default: config.deposit_default ?? 5000 }));
    return;
  }
  required(process.env.SUPABASE_URL, 'SUPABASE_URL'); required(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY');
  const apiKey = 'pa_' + randomBytes(32).toString('base64url');
  const hash = apiKeyHash(apiKey);
  const { createClient } = frontendRequire('@supabase/supabase-js');
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: connection, error: connectionError } = await db.from('payment_connections').select('id').eq('id', config.connection_id).eq('business_id', config.business_id).maybeSingle();
  if (connectionError) throw new Error('Could not validate payment connection (' + (connectionError.code || 'database_error') + ')');
  if (!connection) throw new Error('Payment connection ' + config.connection_id + ' does not belong to business ' + config.business_id);
  const { error } = await db.from('client_apps').insert({ slug: config.slug, business_id: config.business_id, api_key_hash: hash, allowed_origins: config.allowed_origins, connection_id: config.connection_id, deposit_default: config.deposit_default ?? 5000, active: true });
  if (error) throw new Error('Client app registration failed (' + (error.code || 'database_error') + ')');
  console.log(apiKey);
}
module.exports = { apiKeyHash, validateConfig };

if (require.main === module) main().catch((error) => { console.error('Registration failed: ' + (error instanceof Error ? error.message : 'unknown error')); process.exitCode = 1; });
