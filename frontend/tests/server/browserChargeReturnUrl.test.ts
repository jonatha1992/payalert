import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createBrowserCharge } from '@/lib/server/browserCharge';
import type { ClientApp } from '@/lib/server/clientApps';

const mocks = vi.hoisted(() => ({
  feeData: null,
  feeError: null,
  connectionData: {
    provider: 'mercado_pago',
    status: 'CONNECTED',
    credentials_encrypted: 'sealed',
  },
  connectionError: null,
  claimedCharge: null as any,
  updatedCharge: null as any,
  fetchCalls: [] as any[],
}));

vi.mock('@/lib/server/session', () => ({
  getServiceClient: () => ({
    from: (table: string) => ({
      select: (_cols: string) => ({
        eq: (col1: string, val1: any) => ({
          eq: (col2: string, val2: any) => ({
            maybeSingle: async () => ({ data: mocks.connectionData, error: mocks.connectionError }),
          }),
          maybeSingle: async () => ({ data: mocks.feeData, error: mocks.feeError }),
        }),
      }),
      delete: () => ({
        eq: () => ({
          eq: async () => ({ error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock('@/lib/payments/secretBox', () => ({
  decryptSecret: () => JSON.stringify({ access_token: 'test-mp-token' }),
}));

vi.mock('@/lib/server/hubCharges', () => ({
  claimCharge: async (input: any) => {
    mocks.claimedCharge = input;
    return {
      created: true,
      charge: { id: 'charge-123', ...input, status: 'creating', init_point: null },
    };
  },
  updateCreatingCharge: async (id: string, patch: any) => {
    mocks.updatedCharge = { id, ...patch };
    return mocks.updatedCharge;
  },
}));

const fakeApp: ClientApp = {
  id: 'app-huellitas',
  slug: 'huellitas',
  business_id: 'biz-1',
  connection_id: 'conn-1',
  allowed_origins: ['https://huellitasfelices.web.app', 'http://localhost:5000'],
  api_key_hash: 'hash',
  active: true,
  deposit_default: 5000,
  connect_return_url: null,
  item_title: 'Seña Veterinaria',
};

describe('createBrowserCharge return_url & auto_return', () => {
  beforeEach(() => {
    mocks.claimedCharge = null;
    mocks.updatedCharge = null;
    mocks.fetchCalls = [];
    process.env.NEXT_PUBLIC_APP_URL = 'https://payalert.test';
    vi.stubGlobal('fetch', async (url: string, init: any) => {
      mocks.fetchCalls.push({ url, init, body: JSON.parse(init.body) });
      return {
        ok: true,
        json: async () => ({
          id: 'pref-999',
          init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-999',
        }),
      };
    });
  });

  it('configures back_urls and auto_return matching valid requestOrigin', async () => {
    const res = await createBrowserCharge(fakeApp, 'booking-123', 5000, 'Juan Pérez', 'https://huellitasfelices.web.app');

    expect(res.status).toBe('pending');
    expect(res.init_point).toBe('https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-999');

    expect(mocks.claimedCharge.return_url).toBe('https://huellitasfelices.web.app/?pago=booking-123');

    expect(mocks.fetchCalls).toHaveLength(1);
    const mpPayload = mocks.fetchCalls[0].body;
    expect(mpPayload.auto_return).toBe('approved');
    expect(mpPayload.back_urls).toEqual({
      success: 'https://huellitasfelices.web.app/?pago=booking-123',
      failure: 'https://huellitasfelices.web.app/?pago=booking-123',
      pending: 'https://huellitasfelices.web.app/?pago=booking-123',
    });
  });

  it('falls back to app.allowed_origins[0] when requestOrigin is invalid or missing', async () => {
    await createBrowserCharge(fakeApp, 'booking-456', 5000, undefined, 'https://unknown.com');

    expect(mocks.claimedCharge.return_url).toBe('https://huellitasfelices.web.app/?pago=booking-456');
    const mpPayload = mocks.fetchCalls[0].body;
    expect(mpPayload.back_urls.success).toBe('https://huellitasfelices.web.app/?pago=booking-456');
  });
});
