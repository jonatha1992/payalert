import { describe, expect, it, vi } from 'vitest';
import { decryptSecret, encryptSecret } from '../../lib/payments/secretBox';
import { migratePaymentTokens } from '../../../scripts/payment-token-migration.mjs';

const KEY = Buffer.alloc(32, 7).toString('base64');
const logger = { info: vi.fn(), error: vi.fn() } as unknown as Console;

type Token = { id: string; business_id: string; store_id: string | null; provider: string; token_value: string; webhook_secret?: string | null; metadata: Record<string, unknown>; is_active: boolean };
type Connection = { id: string; business_id: string; store_id: string | null; provider: string; provider_account_id: string | null; credentials_encrypted: string | null; status: string };
type Operation = { table: string; filters: Array<[string, unknown]>; columns?: string; kind?: 'insert' | 'update'; value?: Record<string, unknown>; selected?: boolean };

function mockClient(tokens: Token[], existingRows: Connection[] = []) {
  const writes: Operation[] = [];
  const audit: Record<string, unknown>[] = [];
  const client = {
    from(table: string) {
      const operation: Operation = { table, filters: [] };
      const builder = {
        select(columns: string) { operation.columns = columns; return builder; },
        eq(column: string, value: unknown) { operation.filters.push([column, value]); return builder; },
        update(value: Record<string, unknown>) { operation.kind = 'update'; operation.value = value; return builder; },
        insert(value: Record<string, unknown>) { operation.kind = 'insert'; operation.value = value; return builder; },
        single() { if (operation.kind === 'insert') writes.push({ table, value: operation.value, kind: operation.kind, filters: operation.filters, columns: operation.columns, selected: true }); return Promise.resolve({ data: { id: 'connection-new' }, error: null }); },
        maybeSingle() { return Promise.resolve({ data: existingRows[0] ?? null, error: null }); },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          if (table === 'payment_tokens') return Promise.resolve({ data: tokens, error: null }).then(resolve, reject);
          if (table === 'payment_connections' && operation.kind === 'insert') { writes.push({ table, value: operation.value, kind: operation.kind, filters: operation.filters, columns: operation.columns, selected: true }); return Promise.resolve({ data: { id: 'connection-new' }, error: null }).then(resolve, reject); }
          if (table === 'payment_connections' && operation.kind === 'update') { writes.push({ table, value: operation.value, kind: operation.kind, filters: operation.filters }); return Promise.resolve({ data: { id: 'connection-new' }, error: null }).then(resolve, reject); }
          if (table === 'payment_connections' && !operation.kind && operation.columns) return Promise.resolve({ data: existingRows, error: null }).then(resolve, reject);
          if (table === 'audit_logs') { if (operation.value) audit.push(operation.value); return Promise.resolve({ error: null }).then(resolve, reject); }
          writes.push(operation);
          return Promise.resolve({ data: { id: 'connection-new' }, error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return { client, writes, audit };
}

const mpToken = (overrides: Partial<Token> = {}): Token => ({
  id: 'legacy-row', business_id: 'business-1', store_id: 'store-1', provider: 'mp',
  token_value: 'secret-access-token', webhook_secret: 'hook-secret', metadata: { account_id: 'acct-1', label: 'Main' },
  is_active: true, ...overrides,
});

describe('migratePaymentTokens', () => {
  it('encrypts MP credentials and webhook secret, maps scope, and never logs secret data', async () => {
    const { client, writes } = mockClient([mpToken()]);
    const report = await migratePaymentTokens({ client, encryptSecret: (value: string) => encryptSecret(value, KEY), logger, now: () => new Date('2026-01-01T00:00:00Z') });
    const payload = writes.find((entry) => entry.table === 'payment_connections')?.value;
    expect(report).toMatchObject({ migrated: 1, skipped: 0, errors: 0 });
    expect(payload).toMatchObject({ business_id: 'business-1', store_id: 'store-1', provider: 'mercado_pago', provider_account_id: 'acct-1' });
    expect(decryptSecret(String(payload?.credentials_encrypted), KEY)).toBe(JSON.stringify({ access_token: 'secret-access-token' }));
    expect(decryptSecret(String(payload?.webhook_secret_encrypted), KEY)).toBe('hook-secret');
    expect(JSON.stringify(logger)).not.toContain('secret-access-token');
    expect(JSON.stringify(logger)).not.toContain('hook-secret');
  });

  it('skips Ualá records without v2 credentials and records reconnection counts without exposing values', async () => {
    const { client, writes } = mockClient([mpToken({ provider: 'uala', token_value: 'legacy-password', metadata: {} })]);
    const report = await migratePaymentTokens({ client, encryptSecret: (value: string) => encryptSecret(value, KEY), logger });
    expect(report).toMatchObject({ migrated: 0, skipped: 1, reasons: { reconnect_required: 1 } });
    expect(writes).toHaveLength(0);
    expect(JSON.stringify(logger)).not.toContain('legacy-password');
  });

  it('does not write to either target table during dry-run', async () => {
    const { client, writes, audit } = mockClient([mpToken()]);
    const report = await migratePaymentTokens({ client, encryptSecret: (value: string) => encryptSecret(value, KEY), dryRun: true, logger });
    expect(report.migrated).toBe(1);
    expect(writes).toHaveLength(0);
    expect(audit).toHaveLength(0);
  });

  it('recognizes an existing migrated row and stays idempotent', async () => {
    const { client, writes } = mockClient([mpToken()], [{
      id: 'existing', business_id: 'business-1', store_id: 'store-1', provider: 'mercado_pago', provider_account_id: 'acct-1',
      credentials_encrypted: 'enc:v1:sealed', status: 'CONNECTED',
    }]);
    const report = await migratePaymentTokens({ client, encryptSecret: (value: string) => encryptSecret(value, KEY), logger });
    expect(report).toMatchObject({ migrated: 0, skipped: 1, reasons: { already_migrated: 1 } });
    expect(writes).toHaveLength(0);
  });

  it('refuses to migrate if reading existing connections fails', async () => {
    const client = { from: (table: string) => {
      const builder = { select: () => builder, eq: () => builder, then: (resolve: (value: unknown) => unknown) => Promise.resolve(table === 'payment_tokens'
        ? { data: [mpToken()], error: null }
        : { data: null, error: { code: '42501' } }).then(resolve) };
      return builder;
    } };
    const report = await migratePaymentTokens({ client, encryptSecret: (value: string) => encryptSecret(value, KEY), logger });
    expect(report).toMatchObject({ migrated: 0, skipped: 0, errors: 1, reasons: { migration_error: 1 } });
    expect(logger.error).toHaveBeenCalledWith('Payment token migration failed (42501)');
  });
});
