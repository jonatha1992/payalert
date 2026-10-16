#!/usr/bin/env node
/**
 * Idempotent payment_tokens -> payment_connections cutover tool.
 * See docs/STAGING.md for the mandatory backup, comparison, and reconnection plan.
 * Dry-run still reads the source table; only use approved staging credentials.
 */
const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey, PAYMENTS_ENCRYPTION_KEY: key } = process.env;
if (!url || !serviceKey || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or PAYMENTS_ENCRYPTION_KEY');
  process.exit(1);
}

import { createCipheriv, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { migratePaymentTokens } from './payment-token-migration.mjs';


function encryptSecret(plaintext, keyB64 = process.env.PAYMENTS_ENCRYPTION_KEY ?? '') {
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) throw new Error('PAYMENTS_ENCRYPTION_KEY must be 32 bytes encoded as base64');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return ['enc', 'v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ciphertext.toString('base64')].join(':');
}

const dryRun = process.argv.includes('--dry-run');
const client = createClient(url, serviceKey, { auth: { persistSession: false } });
await migratePaymentTokens({ client, encryptSecret, dryRun });
