#!/usr/bin/env node
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');
const { encryptSecret } = require('../frontend/lib/payments/secretBox');
const { createHash, randomBytes } = crypto;
function required(value, name) { if (typeof value !== 'string' || value.trim() === '') throw new Error(name + ' is required'); return value; }
function validateConfig(config) {
  for (const key of ['slug', 'business_id', 'connection_id', 'firebase_project_id']) required(config[key], key);
  if (!Array.isArray(config.allowed_origins) || !Array.isArray(config.admin_emails)) throw new Error('allowed_origins and admin_emails must be arrays');
  if (config.deposit_default !== undefined && (!Number.isInteger(config.deposit_default) || config.deposit_default < 1 || config.deposit_default > 1_000_000)) throw new Error('deposit_default must be an integer from 1 to 1000000');
}
async function main() {
  const filename = process.argv[2];
  if (!filename) throw new Error('Usage: node scripts/register-client-app.js <local-config.json>');
  required(process.env.SUPABASE_URL, 'SUPABASE_URL'); required(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY'); required(process.env.PAYMENTS_ENCRYPTION_KEY, 'PAYMENTS_ENCRYPTION_KEY');
  const configPath = path.resolve(filename);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  validateConfig(config);
  const serviceAccountPath = path.resolve(path.dirname(configPath), required(config.firebase_service_account_file, 'firebase_service_account_file'));
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  const apiKey = randomBytes(32).toString('base64url');
  const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { error } = await db.from('client_apps').insert({ slug: config.slug, business_id: config.business_id, api_key_hash: apiKeyHash, allowed_origins: config.allowed_origins, connection_id: config.connection_id, firebase_project_id: config.firebase_project_id, firebase_sa_encrypted: encryptSecret(JSON.stringify(serviceAccount)), admin_emails: config.admin_emails, deposit_default: config.deposit_default ?? 5000, active: true });
  if (error) throw new Error('Client app registration failed (' + (error.code || 'database_error') + ')');
  console.log('Registered client app ' + config.slug + '. Save this API key now; it will not be shown again: ' + apiKey);
}
main().catch((error) => { console.error('Registration failed: ' + (error instanceof Error ? error.message : 'unknown error')); process.exitCode = 1; });
