import { randomUUID } from 'node:crypto';

const PROVIDER_MAP = new Map([
  ['mercado_pago', 'mercado_pago'],
  ['mp', 'mercado_pago'],
  ['uala', 'uala'],
]);

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function metadataOf(token) {
  return token.metadata && typeof token.metadata === 'object' && !Array.isArray(token.metadata)
    ? token.metadata
    : {};
}

function credentialsFor(token, provider, metadata) {
  if (provider === 'mercado_pago') {
    const accessToken = nonEmptyString(token.token_value);
    return accessToken ? { access_token: accessToken } : null;
  }
  if (provider !== 'uala') return null;

  const credentials = {
    username: nonEmptyString(metadata.username),
    client_id: nonEmptyString(metadata.client_id),
    client_secret_id: nonEmptyString(metadata.client_secret_id),
    environment: nonEmptyString(metadata.environment) ?? 'production',
    amount_in_cents: metadata.amount_in_cents ? 'true' : 'false',
  };
  return credentials.client_secret_id ? credentials : null;
}

function candidateFor(token) {
  const provider = PROVIDER_MAP.get(String(token.provider ?? '').trim().toLowerCase());
  if (!provider) return { reason: 'unsupported_provider' };

  const metadata = metadataOf(token);
  const credentials = credentialsFor(token, provider, metadata);
  if (!credentials) return { reason: provider === 'uala' ? 'reconnect_required' : 'missing_credentials' };
  if (!nonEmptyString(token.business_id)) return { reason: 'missing_business' };

  return {
    provider,
    businessId: token.business_id,
    storeId: nonEmptyString(token.store_id),
    providerAccountId: nonEmptyString(metadata.account_id)
      ?? nonEmptyString(metadata.user_id)
      ?? (provider === 'uala' ? credentials.client_id : null),
    label: nonEmptyString(metadata.label),
    credentials,
    webhookSecret: nonEmptyString(token.webhook_secret),
    tokenId: token.id,
  };
}

function connectionPayload(candidate, encryptSecret) {
  return {
    business_id: candidate.businessId,
    store_id: candidate.storeId,
    provider: candidate.provider,
    provider_account_id: candidate.providerAccountId,
    label: candidate.label,
    status: 'CONNECTED',
    credentials_encrypted: encryptSecret(JSON.stringify(candidate.credentials)),
    webhook_secret_encrypted: candidate.webhookSecret ? encryptSecret(candidate.webhookSecret) : null,
  };
}

function safeError(error) {
  const code = typeof error?.code === 'string' ? error.code : undefined;
  return { code };
}

export async function migratePaymentTokens({ client, encryptSecret, dryRun = false, logger = console, now = () => new Date() }) {
  const report = { migrated: 0, skipped: 0, errors: 0, reasons: {} };
  const count = (reason) => { report.reasons[reason] = (report.reasons[reason] ?? 0) + 1; };
  const skip = (reason) => { report.skipped += 1; count(reason); };

  const { data: tokens, error: readError } = await client
    .from('payment_tokens')
    .select('id, business_id, store_id, provider, token_value, webhook_secret, metadata, is_active')
    .eq('is_active', true);
  if (readError) throw new Error(`Unable to read payment_tokens (${safeError(readError).code ?? 'unknown'})`);

  for (const token of tokens ?? []) {
    const candidate = candidateFor(token);
    if (candidate.reason) {
      skip(candidate.reason);
      continue;
    }

    try {
      const payload = connectionPayload(candidate, encryptSecret);
      const query = client.from('payment_connections').select('id, business_id, store_id, provider, provider_account_id, credentials_encrypted, status').eq('provider', candidate.provider).eq('status', 'CONNECTED');
      const { data: rows, error: lookupError } = await query;
      if (lookupError) throw lookupError;
      const existing = rows ?? [];
      const match = existing.find((row) => row.business_id === candidate.businessId && row.provider === candidate.provider && row.store_id === candidate.storeId && row.provider_account_id === candidate.providerAccountId);
      if (match?.credentials_encrypted) { skip('already_migrated'); continue; }
      const duplicate = existing.find((row) => candidate.providerAccountId && row.provider_account_id === candidate.providerAccountId && row.business_id !== candidate.businessId);
      if (duplicate) { skip('account_conflict'); continue; }

      if (!dryRun) {
        const timestamp = now().toISOString();
        let connectionId;
        if (match) {
          const { data: updated, error: updateError } = await client
            .from('payment_connections')
            .update({ ...payload, last_sync_at: timestamp, updated_at: timestamp })
            .eq('id', match.id)
            .select('id, business_id, store_id, provider, provider_account_id, credentials_encrypted, status')
            .single();
          if (updateError) throw updateError;
          connectionId = updated.id;
        } else {
          const { data: inserted, error: insertError } = await client
            .from('payment_connections')
            .insert({ ...payload, last_sync_at: timestamp })
            .select('id, business_id, store_id, provider, provider_account_id, credentials_encrypted, status')
            .single();
          if (insertError) throw insertError;
          connectionId = inserted.id;
        }

        const { error: auditError } = await client.from('audit_logs').insert({
          business_id: candidate.businessId,
          user_id: null,
          action: 'MIGRATED_PAYMENT_TOKEN',
          entity_type: 'payment_connection',
          entity_id: connectionId,
          new_data: { source_token_id: candidate.tokenId, provider: candidate.provider },
        });
        if (auditError) throw auditError;
      }

      report.migrated += 1;
    } catch (error) {
      report.errors += 1;
      count('migration_error');
      logger.error(`Payment token migration failed (${safeError(error).code ?? 'unknown error'})`);
    }
  }

  logger.info(`Payment token migration: ${report.migrated} migrated, ${report.skipped} skipped, ${report.errors} errors${dryRun ? ' (dry-run)' : ''}`);
  for (const [reason, total] of Object.entries(report.reasons)) {
    logger.info(`  ${reason}: ${total}`);
  }
  return report;
}

export function createMigrationClient({ createClient, url, serviceKey, key }) {
  if (!url || !serviceKey || !key) throw new Error('Missing required migration configuration');
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export function migrationId() {
  return randomUUID();
}
