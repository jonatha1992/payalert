#!/usr/bin/env node
const crypto = require('node:crypto');
const { createHash, randomBytes } = crypto;
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const frontendRequire = createRequire(path.resolve(__dirname, '../frontend/package.json'));

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(name + ' is required');
  return value;
}
function apiKeyHash(apiKey) { return createHash('sha256').update(apiKey).digest('hex'); }
function inviteTokenHash(token) { return createHash('sha256').update(token).digest('hex'); }
function createInviteToken(random = randomBytes) { return 'ci_' + random(32).toString('base64url'); }
function inviteUrl(token, baseUrl = process.env.PAYALERT_URL) {
  const base = required(baseUrl, 'PAYALERT_URL').replace(/\/$/, '');
  return `${base}/connect/${encodeURIComponent(token)}`;
}
function parseHours(value) {
  const hours = Number(value);
  if (!Number.isInteger(hours) || hours < 1 || hours > 720) throw new Error('--hours must be an integer from 1 to 720');
  return hours;
}
function validateConfig(config) {
  required(config.slug, 'slug');
  if (config.business_id !== undefined) required(config.business_id, 'business_id');
  if (config.connection_id !== undefined) required(config.connection_id, 'connection_id');
  if (!Array.isArray(config.allowed_origins) || config.allowed_origins.some((origin) => typeof origin !== 'string' || origin.trim() === '')) throw new Error('allowed_origins must be an array of non-empty strings');
  if (config.deposit_default !== undefined && (!Number.isInteger(config.deposit_default) || config.deposit_default < 1 || config.deposit_default > 1_000_000)) throw new Error('deposit_default must be an integer from 1 to 1000000');
  if (config.connect_return_url !== undefined) validateReturnUrl(config.connect_return_url, config.allowed_origins);
}
function validateReturnUrl(value, origins) {
  let url;
  try { url = new URL(required(value, 'connect_return_url')); } catch { throw new Error('connect_return_url must be an absolute URL'); }
  if (url.protocol !== 'https:') throw new Error('connect_return_url must use https');
  if (!origins.includes(url.origin)) throw new Error('connect_return_url origin must be listed in allowed_origins');
  return url.toString();
}
function parseFlags(args) {
  const flags = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!['--slug', '--hours', '--dry-run'].includes(key)) throw new Error(`Unknown option: ${key}`);
    if (key === '--dry-run') { flags.dryRun = true; continue; }
    const value = args[++index];
    if (!value || value.startsWith('--')) throw new Error(`${key} requires a value`);
    flags[key.slice(2)] = value;
  }
  return flags;
}
function serviceClient() {
  required(process.env.SUPABASE_URL, 'SUPABASE_URL');
  required(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY');
  const { createClient } = frontendRequire('@supabase/supabase-js');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}
async function createInvite(db, slug, hours, options = {}) {
  const token = options.token ?? createInviteToken(options.randomBytes);
  const now = options.now ?? new Date();
  const { data: app, error: appError } = await db.from('client_apps').select('id').eq('slug', slug).eq('active', true).maybeSingle();
  if (appError) throw new Error('Could not load active client app (' + (appError.code || 'database_error') + ')');
  if (!app) throw new Error(`Active client app not found: ${slug}`);
  const { error } = await db.from('connect_invites').insert({ client_app_id: app.id, token_hash: inviteTokenHash(token), expires_at: new Date(now.getTime() + hours * 3_600_000).toISOString() });
  if (error) throw new Error('Invite creation failed (' + (error.code || 'database_error') + ')');
  return inviteUrl(token, options.baseUrl);
}
async function getOrCreateBusiness(db, slug, businessId) {
  if (businessId) return businessId;
  const name = `app:${slug}`;
  const { data: existing, error: lookupError } = await db.from('businesses').select('id').eq('name', name).maybeSingle();
  if (lookupError) throw new Error('Could not find hidden business (' + (lookupError.code || 'database_error') + ')');
  if (existing) return existing.id;
  const { data: created, error: createError } = await db.from('businesses').insert({ name }).select('id').single();
  if (createError) throw new Error('Hidden business creation failed (' + (createError.code || 'database_error') + ')');
  return created.id;
}
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] === 'invite' ? args.shift() : null;
  if (command) {
    const flags = parseFlags(args);
    const slug = required(flags.slug, '--slug');
    const hours = parseHours(flags.hours ?? '24');
    if (flags.dryRun) {
      const token = createInviteToken();
      console.log(JSON.stringify({ valid: true, slug, hours, token_hash: inviteTokenHash(token), url: inviteUrl(token) }));
      return;
    }
    const url = await createInvite(serviceClient(), slug, hours);
    console.log(url);
    return;
  }

  const dryRun = args.includes('--dry-run');
  const positional = args.filter((arg) => arg !== '--dry-run');
  const filename = positional[0];
  if (!filename || positional.length !== 1) throw new Error('Usage: node scripts/register-client-app.js [--dry-run] <local-config.json> | invite --slug <slug> [--hours 24] [--dry-run]');
  const config = JSON.parse(fs.readFileSync(path.resolve(filename), 'utf8'));
  validateConfig(config);
  if (dryRun) {
    console.log(JSON.stringify({ valid: true, slug: config.slug, business_id: config.business_id, connection_id: config.connection_id ?? null, allowed_origins: config.allowed_origins, deposit_default: config.deposit_default ?? 5000, connect_return_url: config.connect_return_url ?? null }));
    return;
  }
  const db = serviceClient();
  const businessId = await getOrCreateBusiness(db, config.slug, config.business_id);
  if (config.connection_id) {
    const { data: connection, error: connectionError } = await db.from('payment_connections').select('id').eq('id', config.connection_id).eq('business_id', businessId).maybeSingle();
    if (connectionError) throw new Error('Could not validate payment connection (' + (connectionError.code || 'database_error') + ')');
    if (!connection) throw new Error('Payment connection ' + config.connection_id + ' does not belong to business ' + businessId);
  }
  const apiKey = 'pa_' + randomBytes(32).toString('base64url');
  const hash = apiKeyHash(apiKey);
  const { error } = await db.from('client_apps').insert({ slug: config.slug, business_id: businessId, api_key_hash: hash, allowed_origins: config.allowed_origins, connection_id: config.connection_id ?? null, connect_return_url: config.connect_return_url ?? null, deposit_default: config.deposit_default ?? 5000, active: true });
  if (error) throw new Error('Client app registration failed (' + (error.code || 'database_error') + ')');
  console.log(apiKey);
  if (!config.connection_id) console.log(await createInvite(db, config.slug, config.invite_hours === undefined ? 24 : parseHours(String(config.invite_hours))));
}
module.exports = { apiKeyHash, createInvite, createInviteToken, getOrCreateBusiness, inviteTokenHash, inviteUrl, parseHours, validateConfig, validateReturnUrl };

if (require.main === module) main().catch((error) => { console.error('Registration failed: ' + (error instanceof Error ? error.message : 'unknown error')); process.exitCode = 1; });
