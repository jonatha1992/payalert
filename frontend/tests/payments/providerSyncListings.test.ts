import { describe, expect, it, vi } from 'vitest';
import { MercadoPagoConnector } from '@/lib/payments/connectors/mercadopago';
import { UalaConnector } from '@/lib/payments/connectors/uala';
import type { PaymentConnection } from '@/lib/payments/types';

const connection: PaymentConnection = { id: 'c', businessId: 'b', storeId: null, provider: 'mercado_pago',
  providerAccountId: '22', status: 'CONNECTED', credentials: { access_token: 'token-private' }, webhookSecret: null };

describe('provider recent payment listings', () => {
  it('normalizes recent Mercado Pago results from the documented search endpoint', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      void input;
      return new Response(JSON.stringify({ results: [{ id: 42, collector_id: 22,
        transaction_amount: 10, currency_id: 'ARS', status: 'approved', date_created: '2026-10-16T10:00:00Z' }] }), { status: 200 });
    });
    const connector = new MercadoPagoConnector(fetcher);
    const result = await connector.listRecentTransactions(connection);
    expect(result).toMatchObject([{ externalId: '42', status: 'CONFIRMED', amount: 10 }]);
    expect(String(fetcher.mock.calls[0][0])).toContain('/v1/payments/search?');
  });

  it('fetches Ualá orders through its documented listing URL and reports authoritative status', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'opaque' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ uuid: 'order-1', amount: 100,
        status: 'APPROVED', created_date: '2026-10-16T10:00:00Z' }]), { status: 200 }));
    const result = await new UalaConnector(fetcher).listRecentTransactions({ ...connection, provider: 'uala',
      credentials: { username: 'u', client_id: 'client', client_secret_id: 'private', environment: 'production' } });
    expect(result).toMatchObject([{ externalId: 'order-1', status: 'CONFIRMED' }]);
    expect(String(fetcher.mock.calls[1][0])).toContain('/orders?');
  });
});
