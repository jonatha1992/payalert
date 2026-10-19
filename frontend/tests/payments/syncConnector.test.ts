import { describe, expect, it, vi } from 'vitest';
import { MercadoPagoConnector } from '@/lib/payments/connectors/mercadopago';
import { connectorForSyncedTransaction } from '@/lib/payments/syncConnector';
import type { NormalizedTransaction, PaymentConnection } from '@/lib/payments/types';

const tx = { externalId: '185030888876', provider: 'mercado_pago', providerAccountId: '1', amount: 100, status: 'CONFIRMED' } as unknown as NormalizedTransaction;

describe('connectorForSyncedTransaction', () => {
  it('conserva los métodos de la clase real y entrega el pago ya consultado', async () => {
    const real = new MercadoPagoConnector(vi.fn());
    const wrapped = connectorForSyncedTransaction(real, tx);
    expect(typeof wrapped.healthCheck).toBe('function');
    expect(wrapped.parseWebhook({ rawBody: '', headers: {}, query: {} }, null)).toMatchObject({ kind: 'accepted', externalId: '185030888876' });
    await expect(wrapped.fetchTransaction({} as PaymentConnection, '185030888876')).resolves.toBe(tx);
    await expect(wrapped.fetchTransaction({} as PaymentConnection, 'otro')).rejects.toThrow('sync_transaction_id_mismatch');
  });
});
