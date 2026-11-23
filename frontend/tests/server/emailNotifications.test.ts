import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CorreoCentralClient } from '@/lib/server/correoCentral';
import { sendPaymentEmailToBusiness } from '@/lib/server/emailNotifications';

function mockDb(users: unknown[], prefs: unknown[]): SupabaseClient {
  return {
    from: (table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: async () => ({ data: users, error: null }),
          }),
        };
      }
      if (table === 'user_notification_preferences') {
        return {
          select: () => ({
            eq: () => ({
              in: async () => ({ data: prefs, error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;
}

describe('sendPaymentEmailToBusiness', () => {
  const notification = {
    transactionId: 'tx-123',
    amount: 15000,
    currency: 'ARS',
    provider: 'mercado_pago' as const,
    occurredAt: '2026-11-23T12:00:00.000Z',
  };

  it('returns zero counts without querying db when correo-central is not configured', async () => {
    const client: CorreoCentralClient = {
      isConfigured: () => false,
      send: vi.fn(),
    };
    const fromSpy = vi.fn();
    const db = { from: fromSpy } as unknown as SupabaseClient;

    const result = await sendPaymentEmailToBusiness({ businessId: 'biz-1' }, notification, { db, client });

    expect(result).toEqual({ sent: 0, failed: 0, total: 0 });
    expect(fromSpy).not.toHaveBeenCalled();
    expect(client.send).not.toHaveBeenCalled();
  });

  it('sends only to scoped users who opted into email_enabled', async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, id: 're_1', from: 'PayAlert <avisos@tecnofusion.dev>', status: 'sent', replayed: false });
    const client: CorreoCentralClient = { isConfigured: () => true, send };
    const db = mockDb(
      [
        { id: 'u-owner', email: 'owner@ejemplo.com', role: 'owner', assigned_store_id: null },
        { id: 'u-store-a', email: 'a@ejemplo.com', role: 'employee', assigned_store_id: 'store-a' },
        { id: 'u-store-b', email: 'b@ejemplo.com', role: 'employee', assigned_store_id: 'store-b' },
        { id: 'u-optout', email: 'off@ejemplo.com', role: 'owner', assigned_store_id: null },
      ],
      [
        { user_id: 'u-owner', email_enabled: true },
        { user_id: 'u-store-a', email_enabled: true },
        { user_id: 'u-store-b', email_enabled: true },
        { user_id: 'u-optout', email_enabled: false },
      ],
    );

    const result = await sendPaymentEmailToBusiness(
      { businessId: 'biz-1', storeId: 'store-a' },
      notification,
      { db, client, appUrl: 'https://payalert.tecnofusion.dev' },
    );

    expect(result).toEqual({ sent: 2, failed: 0, total: 2 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      to: 'owner@ejemplo.com',
      idempotencyKey: 'payment-tx-123-u-owner',
    }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      to: 'a@ejemplo.com',
      idempotencyKey: 'payment-tx-123-u-store-a',
    }));
    const firstPayload = send.mock.calls[0][0];
    expect(firstPayload.subject).toContain('ARS');
    expect(firstPayload.text).toContain('Mercado Pago');
    expect(firstPayload.html).toContain('https://payalert.tecnofusion.dev/dashboard/terminal');
  });

  it('counts failed deliveries without throwing', async () => {
    const send = vi.fn().mockResolvedValue({ ok: false, reason: 'http_error', status: 502 });
    const client: CorreoCentralClient = { isConfigured: () => true, send };
    const db = mockDb(
      [{ id: 'u-1', email: 'owner@ejemplo.com', role: 'owner', assigned_store_id: null }],
      [{ user_id: 'u-1', email_enabled: true }],
    );

    const result = await sendPaymentEmailToBusiness({ businessId: 'biz-1' }, notification, { db, client });

    expect(result).toEqual({ sent: 0, failed: 1, total: 1 });
  });
});
