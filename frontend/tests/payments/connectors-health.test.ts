import { describe, expect, it, vi } from 'vitest';
import { MercadoPagoConnector } from '../../lib/payments/connectors/mercadopago';
import { UalaConnector } from '../../lib/payments/connectors/uala';
import type { PaymentConnection } from '../../lib/payments/types';

const connection = (provider: 'mercado_pago' | 'uala'): PaymentConnection => ({
  id: 'connection-id', businessId: 'business-id', storeId: null, provider,
  providerAccountId: null, status: 'CONNECTED', webhookSecret: null,
  credentials: provider === 'mercado_pago'
    ? { access_token: 'fake-token' }
    : { username: 'test', client_id: 'fake-client', client_secret_id: 'fake-secret' },
});

const response = (status: number) => new Response('{}', { status });

describe('connector health checks', () => {
  it('distinguishes invalid Mercado Pago credentials from temporary provider failure', async () => {
    const unauthorized = new MercadoPagoConnector(vi.fn().mockResolvedValue(response(401)) as typeof fetch);
    const unavailable = new MercadoPagoConnector(vi.fn().mockResolvedValue(response(503)) as typeof fetch);
    expect(await unauthorized.healthCheck(connection('mercado_pago'))).toEqual({ ok: false, detail: 'invalid_token' });
    expect(await unavailable.healthCheck(connection('mercado_pago'))).toEqual({ ok: false, detail: 'provider_unavailable' });
  });

  it('distinguishes rejected Ualá credentials from temporary auth outages', async () => {
    const unauthorized = new UalaConnector(vi.fn().mockResolvedValue(response(401)) as typeof fetch);
    const unavailable = new UalaConnector(vi.fn().mockResolvedValue(response(503)) as typeof fetch);
    expect(await unauthorized.healthCheck(connection('uala'))).toEqual({ ok: false, detail: 'invalid_token' });
    expect(await unavailable.healthCheck(connection('uala'))).toEqual({ ok: false, detail: 'provider_unavailable' });
  });
});
