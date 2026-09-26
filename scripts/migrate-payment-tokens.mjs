#!/usr/bin/env node
/**
 * Migrador idempotente: payment_tokens -> payment_connections
 * Lee credenciales en texto plano de payment_tokens, las cifra con secretBox
 * y las inserta/actualiza en payment_connections.
 * Requiere PAYMENTS_ENCRYPTION_KEY en variables de entorno (32 bytes base64).
 *
 * Uso:
 *   PAYMENTS_ENCRYPTION_KEY=<base64> node scripts/migrate-payment-tokens.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { encryptSecret, isEncryptedSecret } from '../lib/payments/secretBox.js';

const DRY_RUN = process.argv.includes('--dry-run');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!process.env.PAYMENTS_ENCRYPTION_KEY) {
  console.error('Falta PAYMENTS_ENCRYPTION_KEY (32 bytes base64). Generar con: openssl rand -base64 32');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN (sin cambios)' : 'EJECUCIÓN REAL'}`);
  console.log('Leyendo payment_tokens...');

  const { data: tokens, error } = await supabase
    .from('payment_tokens')
    .select('*')
    .eq('is_active', true);

  if (error) throw error;
  if (!tokens?.length) {
    console.log('No hay tokens activos que migrar');
    return;
  }

  console.log(`Tokens encontrados: ${tokens.length}`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const token of tokens) {
    try {
      const provider = token.provider;
      const businessId = token.business_id;
      const storeId = token.store_id || null;

      // Determinar account_id: para MP viene del token (access_token no tiene ID, hay que consultar /users/me)
      // Para Ualá, el account_id es el username o client_id. Usamos business_id como fallback.
      let providerAccountId = token.metadata?.account_id || token.metadata?.user_id || null;

      // Preparar credenciales según proveedor
      let credentials;
      let webhookSecret = token.webhook_secret || null;

      if (provider === 'mercado_pago') {
        // token_value ya es el access_token
        credentials = { access_token: token.token_value };
      } else if (provider === 'uala') {
        // token_value en Ualá es el password (legacy). Mapeamos a credenciales v2.
        credentials = {
          username: token.metadata?.username || '',
          client_id: token.metadata?.client_id || '',
          client_secret_id: token.metadata?.client_secret_id || '',
          environment: token.metadata?.environment || 'production',
          amount_in_cents: token.metadata?.amount_in_cents ? 'true' : 'false',
        };
        // El password legacy no se usa en v2; si no hay client_secret_id, marcar para reconexión
        if (!credentials.client_secret_id) {
          console.warn(`  ⚠ Ualá token ${token.id}: falta client_secret_id, requerirá reconexión manual`);
        }
      } else {
        console.warn(`  ⚠ Proveedor desconocido ${provider} en token ${token.id}, saltando`);
        skipped++;
        continue;
      }

      // Cifrar
      const credentialsEncrypted = encryptSecret(JSON.stringify(credentials));
      const webhookSecretEncrypted = webhookSecret ? encryptSecret(webhookSecret) : null;

      // Verificar si ya existe conexión para este provider+account
      let existingId = null;
      if (providerAccountId) {
        const { data: existing } = await supabase
          .from('payment_connections')
          .select('id')
          .eq('provider', provider)
          .eq('provider_account_id', providerAccountId)
          .neq('status', 'DISCONNECTED')
          .maybeSingle();
        existingId = existing?.id || null;
      }

      if (existingId) {
        if (!DRY_RUN) {
          const { error: updErr } = await supabase
            .from('payment_connections')
            .update({
              business_id: businessId,
              store_id: storeId,
              label: token.metadata?.label || null,
              status: 'CONNECTED',
              credentials_encrypted: credentialsEncrypted,
              webhook_secret_encrypted: webhookSecretEncrypted,
              last_sync_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingId);
          if (updErr) throw updErr;
        }
        console.log(`  ✓ Actualizada conexión ${existingId} (${provider}) para negocio ${businessId}`);
        migrated++;
      } else {
        const insertData = {
          business_id: businessId,
          store_id: storeId,
          provider,
          provider_account_id: providerAccountId,
          label: token.metadata?.label || null,
          status: 'CONNECTED',
          credentials_encrypted: credentialsEncrypted,
          webhook_secret_encrypted: webhookSecretEncrypted,
          last_sync_at: new Date().toISOString(),
        };

        if (!DRY_RUN) {
          const { data: inserted, error: insErr } = await supabase
            .from('payment_connections')
            .insert(insertData)
            .select('id')
            .single();
          if (insErr) {
            // Duplicado por índice único (otro negocio ya tiene esa cuenta)
            if (insErr.code === '23505') {
              console.warn(`  ⚠ Cuenta ${provider}:${providerAccountId} ya pertenece a otro negocio, saltando token ${token.id}`);
              skipped++;
              continue;
            }
            throw insErr;
          }
          console.log(`  ✓ Creada conexión ${inserted.id} (${provider}) para negocio ${businessId}`);
        } else {
          console.log(`  ✓ [DRY-RUN] Se crearía conexión (${provider}) para negocio ${businessId}`);
        }
        migrated++;
      }

      // Auditar migración
      if (!DRY_RUN) {
        await supabase.from('audit_logs').insert({
          business_id: businessId,
          user_id: null,
          action: 'MIGRATED_PAYMENT_TOKEN',
          entity_type: 'payment_connection',
          entity_id: existingId || null,
          new_data: { source_token_id: token.id, provider, provider_account_id: providerAccountId },
        });
      }
    } catch (e) {
      console.error(`  ✗ Error migrando token ${token.id}:`, e.message);
      errors++;
    }
  }

  console.log(`\nResumen: ${migrated} migrados/actualizados, ${skipped} omitidos, ${errors} errores`);
  if (DRY_RUN) console.log('(DRY-RUN: no se aplicaron cambios)');
}

main().catch((e) => {
  console.error('Error fatal:', e);
  process.exit(1);
});