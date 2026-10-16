import { createApiClient, ApiError } from '../src/api/client';
import { vi } from 'vitest';

describe('createApiClient', () => {
  it('sends the Supabase access token as a Bearer header and parses JSON', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer jwt-abc');
      return new Response(JSON.stringify({ transactions: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 } }), { status: 200 });
    }) as unknown as typeof fetch;
    const request = createApiClient('https://api.example/', async () => 'jwt-abc', fetcher);
    await expect(request('/api/reports/movements')).resolves.toEqual({ transactions: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 } });
    expect(fetcher).toHaveBeenCalledWith('https://api.example/api/reports/movements', expect.any(Object));
  });

  it('surfaces a typed 401 with the backend error message', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 })) as unknown as typeof fetch;
    const request = createApiClient('https://api.example', async () => 'expired', fetcher);
    await expect(request('/api/expected-payments')).rejects.toMatchObject({ name: 'ApiError', status: 401, message: 'No autenticado' });
  });

  it('does not send a request when no session token exists', async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    const request = createApiClient('https://api.example', async () => null, fetcher);
    await expect(request('/api/expected-payments')).rejects.toBeInstanceOf(ApiError);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
