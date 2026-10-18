import { describe, expect, it, vi } from 'vitest';
import { ensureFreshCredentials } from '@/lib/payments/tokenRefresh';
import type { PaymentConnection } from '@/lib/payments/types';

const NOW = Date.parse('2026-10-18T12:00:00.000Z');
const connection = (credentials: Record<string, string>): PaymentConnection => ({ id: 'c1', businessId: 'b1',
  storeId: null, provider: 'mercado_pago', providerAccountId: 'acc', status: 'CONNECTED', credentials, webhookSecret: null });

describe('ensureFreshCredentials', () => {
  it('no renueva un token vigente ni toca el proveedor', async () => {
    const refresh = vi.fn();
    const persist = vi.fn();
    const input = connection({ auth_type: 'oauth', access_token: 'a', refresh_token: 'r', expires_at: '2026-10-18T13:00:00.000Z' });
    const result = await ensureFreshCredentials(input, { refresh, persist, markReauthRequired: vi.fn(), now: () => NOW });
    expect(result).toBe(input);
    expect(refresh).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it('renueva un token vencido, lo guarda y devuelve la conexión con el nuevo token', async () => {
    const refresh = vi.fn(async () => ({ access_token: 'nuevo', refresh_token: 'r2', expires_in: 3600 }));
    const persist = vi.fn(async () => undefined);
    const input = connection({ auth_type: 'oauth', access_token: 'viejo', refresh_token: 'r', expires_at: '2026-10-18T11:00:00.000Z' });
    const result = await ensureFreshCredentials(input, { refresh, persist, markReauthRequired: vi.fn(), now: () => NOW });
    expect(refresh).toHaveBeenCalledWith('r');
    expect(result.credentials.access_token).toBe('nuevo');
    expect(result.credentials.refresh_token).toBe('r2');
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('renueva también si faltan menos de 5 minutos', async () => {
    const refresh = vi.fn(async () => ({ access_token: 'n', refresh_token: 'r2', expires_in: 3600 }));
    const input = connection({ auth_type: 'oauth', access_token: 'v', refresh_token: 'r', expires_at: '2026-10-18T12:03:00.000Z' });
    await ensureFreshCredentials(input, { refresh, persist: vi.fn(), markReauthRequired: vi.fn(), now: () => NOW });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('si la renovación falla, marca reconexión requerida y lanza error', async () => {
    const markReauthRequired = vi.fn(async () => undefined);
    const input = connection({ auth_type: 'oauth', access_token: 'v', refresh_token: 'r', expires_at: '2026-10-18T11:00:00.000Z' });
    await expect(ensureFreshCredentials(input, { refresh: vi.fn().mockRejectedValue(new Error('x')),
      persist: vi.fn(), markReauthRequired, now: () => NOW })).rejects.toThrow('oauth_refresh_failed');
    expect(markReauthRequired).toHaveBeenCalledWith(input);
  });

  it('sin refresh_token en un token vencido marca reconexión requerida', async () => {
    const markReauthRequired = vi.fn(async () => undefined);
    const input = connection({ auth_type: 'oauth', access_token: 'v', expires_at: '2026-10-18T11:00:00.000Z' });
    await expect(ensureFreshCredentials(input, { refresh: vi.fn(), persist: vi.fn(), markReauthRequired,
      now: () => NOW })).rejects.toThrow('oauth_refresh_failed');
    expect(markReauthRequired).toHaveBeenCalledTimes(1);
  });

  it('ignora credenciales cargadas a mano (sin oauth)', async () => {
    const refresh = vi.fn();
    const input = connection({ access_token: 'manual' });
    const result = await ensureFreshCredentials(input, { refresh, persist: vi.fn(), markReauthRequired: vi.fn(), now: () => NOW });
    expect(result).toBe(input);
    expect(refresh).not.toHaveBeenCalled();
  });
});
