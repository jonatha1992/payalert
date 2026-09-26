// Server-only module: payment connections (integrations) for one business.
import { MercadoPagoConnector } from '@/lib/payments/connectors/mercadopago';
import { UalaConnector } from '@/lib/payments/connectors/uala';
import { MockConnector } from '@/lib/payments/connectors/mock';
import { encryptSecret } from '@/lib/payments/secretBox';
import type { PaymentConnection, Provider } from '@/lib/payments/types';
import { ScopeError } from '@/lib/server/scope';
import { getServiceClient } from '@/lib/server/session';

/** Public view of a connection. Never includes credentials or secrets. */
export interface ConnectionView {
  id: string;
  provider: Provider;
  storeId: string | null;
  storeName: string | null;
  label: string | null;
  providerAccountId: string | null;
  status: string;
  hasWebhookSecret: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface CreateConnectionInput {
  provider: Provider;
  storeId?: string | null;
  label?: string | null;
  /** Mercado Pago */
  accessToken?: string;
  webhookSecret?: string;
  /** Ualá Bis */
  username?: string;
  clientId?: string;
  clientSecretId?: string;
  environment?: 'production' | 'stage';
  amountInCents?: boolean;
}

const required = (value: string | undefined, field: string): string => {
  const trimmed = (value ?? '').trim();
  if (!trimmed) throw new ScopeError(`Falta el campo ${field}`, 400);
  return trimmed;
};

async function mercadoPagoAccountId(accessToken: string): Promise<string> {
  const response = await fetch('https://api.mercadopago.com/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new ScopeError('Mercado Pago rechazó el Access Token', 400);
  const me = (await response.json()) as { id?: number | string };
  if (me.id === undefined || me.id === null) throw new ScopeError('Mercado Pago no devolvió el id de la cuenta', 400);
  return String(me.id);
}

function getConnector(provider: Provider) {
  switch (provider) {
    case 'mercado_pago':
      return new MercadoPagoConnector();
    case 'uala':
      return new UalaConnector();
    case 'mock':
      return new MockConnector();
    default:
      throw new ScopeError('Proveedor no soportado', 400);
  }
}

export async function listConnections(businessId: string): Promise<ConnectionView[]> {
  const { data, error } = await getServiceClient()
    .from('payment_connections')
    .select('id, provider, store_id, label, provider_account_id, status, webhook_secret_encrypted, last_sync_at, last_error, created_at, store:stores(name)')
    .eq('business_id', businessId)
    .neq('status', 'DISCONNECTED')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    provider: row.provider,
    storeId: row.store_id,
    storeName: (row.store as unknown as { name?: string } | null)?.name ?? null,
    label: row.label,
    providerAccountId: row.provider_account_id,
    status: row.status,
    hasWebhookSecret: Boolean(row.webhook_secret_encrypted),
    lastSyncAt: row.last_sync_at,
    lastError: row.last_error,
    createdAt: row.created_at,
  }));
}

export async function createConnection(
  businessId: string,
  userId: string,
  input: CreateConnectionInput,
): Promise<ConnectionView> {
  let credentials: Record<string, string>;
  let providerAccountId: string | null = null;
  let webhookSecret: string | null = null;

  if (input.provider === 'mercado_pago') {
    const accessToken = required(input.accessToken, 'accessToken');
    webhookSecret = required(input.webhookSecret, 'webhookSecret');
    providerAccountId = await mercadoPagoAccountId(accessToken);
    credentials = { access_token: accessToken };
  } else if (input.provider === 'uala') {
    credentials = {
      username: required(input.username, 'username'),
      client_id: required(input.clientId, 'clientId'),
      client_secret_id: required(input.clientSecretId, 'clientSecretId'),
      environment: input.environment === 'stage' ? 'stage' : 'production',
      amount_in_cents: input.amountInCents ? 'true' : 'false',
    };
  } else if (input.provider === 'mock') {
    if (process.env.NODE_ENV === 'production' && process.env.PAYMENTS_ENABLE_SIMULATOR !== 'true') {
      throw new ScopeError('El conector de prueba está deshabilitado', 403);
    }
    credentials = {};
  } else {
    throw new ScopeError('Proveedor no soportado', 400);
  }

  const db = getServiceClient();
  if (input.storeId) {
    const { data: store } = await db
      .from('stores')
      .select('id')
      .eq('id', input.storeId)
      .eq('business_id', businessId)
      .maybeSingle();
    if (!store) throw new ScopeError('La tienda no pertenece a este negocio', 403);
  }

  const { data, error } = await db
    .from('payment_connections')
    .insert({
      business_id: businessId,
      store_id: input.storeId || null,
      provider: input.provider,
      provider_account_id: providerAccountId,
      label: input.label?.trim() || null,
      status: 'CONNECTED',
      credentials_encrypted: encryptSecret(JSON.stringify(credentials)),
      webhook_secret_encrypted: webhookSecret ? encryptSecret(webhookSecret) : null,
      created_by: userId,
      last_sync_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') {
      throw new ScopeError('Esta cuenta ya está conectada a un negocio', 400);
    }
    throw error;
  }

  await db.from('audit_logs').insert({
    business_id: businessId,
    user_id: userId,
    action: 'ACCOUNT_CONNECTED',
    entity_type: 'payment_connection',
    entity_id: data.id,
    new_data: { provider: input.provider, store_id: input.storeId || null },
  });

  const views = await listConnections(businessId);
  const created = views.find((view) => view.id === data.id);
  if (!created) throw new Error('Connection was not persisted');
  return created;
}

export async function disconnectConnection(businessId: string, userId: string, id: string): Promise<void> {
  const db = getServiceClient();
  const { data, error } = await db
    .from('payment_connections')
    .update({
      status: 'DISCONNECTED',
      // Credentials are destroyed on disconnect; the row stays for audit/history.
      credentials_encrypted: encryptSecret('{}'),
      webhook_secret_encrypted: null,
    })
    .eq('id', id)
    .eq('business_id', businessId)
    .select('id, provider');
  if (error) throw error;
  if (!data || data.length === 0) throw new ScopeError('Integración no encontrada', 403);

  await db.from('audit_logs').insert({
      business_id: businessId,
      user_id: userId,
      action: 'ACCOUNT_DISCONNECTED',
      entity_type: 'payment_connection',
      entity_id: id,
      new_data: { provider: data[0].provider },
    });
  }

  /**
   * Verifica la salud de una conexión consultando al proveedor y actualiza
   * last_sync_at / last_error / status en la base de datos.
   * Devuelve { ok, detail }.
   */
  export async function checkConnectionHealth(
    businessId: string,
    connectionId: string
  ): Promise<{ ok: boolean; detail?: string }> {
    const db = getServiceClient();
    const { data: connection, error } = await db
      .from('payment_connections')
      .select('id, provider, provider_account_id, status, credentials_encrypted, webhook_secret_encrypted')
      .eq('id', connectionId)
      .eq('business_id', businessId)
      .maybeSingle<{
        id: string;
        provider: Provider;
        provider_account_id: string | null;
        status: string;
        credentials_encrypted: string;
        webhook_secret_encrypted: string | null;
      }>();

    if (error) throw error;
    if (!connection) throw new ScopeError('Integración no encontrada', 403);

    // No chequear si ya está desconectada
    if (connection.status === 'DISCONNECTED') {
      return { ok: false, detail: 'disconnected' };
    }

    const { decryptSecret } = await import('@/lib/payments/secretBox');
    let credentials: Record<string, string>;
    try {
      credentials = JSON.parse(decryptSecret(connection.credentials_encrypted)) as Record<string, string>;
    } catch {
      return { ok: false, detail: 'credenciales_invalidas' };
    }

    const connector = getConnector(connection.provider);
    const result = await connector.healthCheck({
          id: connection.id,
          businessId,
          storeId: null,
          provider: connection.provider,
          providerAccountId: connection.provider_account_id,
          status: connection.status as any,
          credentials,
          webhookSecret: connection.webhook_secret_encrypted ? decryptSecret(connection.webhook_secret_encrypted) : null,
        });

        const now = new Date().toISOString();
        const newStatus = result.ok ? 'CONNECTED' : 'ERROR';
        const { error: updErr } = await db
          .from('payment_connections')
          .update({
            status: newStatus,
            last_sync_at: now,
            last_error: result.ok ? null : (result as any).detail || 'health_check_failed',
            updated_at: now,
          })
          .eq('id', connectionId)
          .eq('business_id', businessId);
    if (updErr) console.error('[health] update failed:', updErr.message);

    return result;
  }
