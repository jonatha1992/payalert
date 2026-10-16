import type { NormalizedTransaction, PaymentConnection } from './types';

export interface SyncDependencies {
  listTransactions(connection: PaymentConnection): Promise<NormalizedTransaction[]>;
  ingest(connection: PaymentConnection, transaction: NormalizedTransaction): Promise<'processed' | 'duplicate' | 'failed'>;
  recordFreshness(connection: PaymentConnection, checkedAt: string): Promise<void>;
  audit(connection: PaymentConnection, checkedAt: string, newlyProcessed: number): Promise<void>;
  log(fields: { event: 'manual_sync'; connectionId: string; businessId: string; outcome: 'success' | 'provider_error' | 'ingest_error'; checked: number; newlyProcessed: number }): void;
  now?: () => Date;
}

export interface SyncResult {
  checked: number;
  newlyProcessed: number;
  lastSyncAt: string;
  source: 'mercado_pago' | 'uala' | 'mock';
}

export async function syncConnectionPayments(connection: PaymentConnection, dependencies: SyncDependencies): Promise<SyncResult> {
  const now = dependencies.now ?? (() => new Date());
  let payments: NormalizedTransaction[];
  try {
    payments = await dependencies.listTransactions(connection);
  } catch {
    dependencies.log({ event: 'manual_sync', connectionId: connection.id, businessId: connection.businessId,
      outcome: 'provider_error', checked: 0, newlyProcessed: 0 });
    throw new Error('provider_sync_failed');
  }

  let newlyProcessed = 0;
  for (const payment of payments) {
    if (payment.provider !== connection.provider || (payment.providerAccountId && connection.providerAccountId
      && payment.providerAccountId !== connection.providerAccountId)) throw new Error('provider_sync_account_mismatch');
    try {
      if (await dependencies.ingest(connection, payment) === 'processed') newlyProcessed += 1;
    } catch {
      dependencies.log({ event: 'manual_sync', connectionId: connection.id, businessId: connection.businessId,
        outcome: 'ingest_error', checked: payments.length, newlyProcessed });
      throw new Error('provider_sync_ingest_failed');
    }
  }
  const lastSyncAt = now().toISOString();
  await dependencies.recordFreshness(connection, lastSyncAt);
  await dependencies.audit(connection, lastSyncAt, newlyProcessed);
  dependencies.log({ event: 'manual_sync', connectionId: connection.id, businessId: connection.businessId,
    outcome: 'success', checked: payments.length, newlyProcessed });
  return { checked: payments.length, newlyProcessed, lastSyncAt, source: connection.provider };
}
