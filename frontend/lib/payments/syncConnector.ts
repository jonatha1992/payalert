import type { NormalizedTransaction, PaymentConnector, PaymentConnection } from './types';

/**
 * Connector view for ingesting a payment we already fetched from the provider (sync).
 * Wraps the real connector instead of spreading it: spreading a class instance drops its
 * prototype methods (parseWebhook, health, ...), which broke every synced payment.
 */
export function connectorForSyncedTransaction(connector: PaymentConnector, transaction: NormalizedTransaction): PaymentConnector {
  return Object.assign(Object.create(connector), {
    parseWebhook: () => ({
      kind: 'accepted' as const,
      externalId: transaction.externalId,
      providerAccountId: transaction.providerAccountId ?? null,
      providerOrderId: null,
      eventType: 'sync',
    }),
    fetchTransaction: async (_: PaymentConnection, externalId: string) => {
      if (externalId !== transaction.externalId) throw new Error('sync_transaction_id_mismatch');
      return transaction;
    },
  }) as PaymentConnector;
}
