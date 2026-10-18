import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server/session', () => ({
  getServiceClient: () => { throw new Error('la base no debe tocarse sin autorización'); },
}));

import { GET, POST } from '@/app/api/internal/sync-connections/route';

const call = (handler: typeof GET, authorization?: string) =>
  handler(new Request('https://example.test/api/internal/sync-connections', {
    headers: authorization ? { authorization } : {},
  }) as never);

afterEach(() => vi.unstubAllEnvs());

describe('/api/internal/sync-connections', () => {
  it('devuelve 503 si CRON_SECRET no está configurado', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect((await call(POST, 'Bearer cualquiera')).status).toBe(503);
  });

  it('devuelve 401 sin clave o con clave incorrecta, sin tocar la base', async () => {
    vi.stubEnv('CRON_SECRET', 'secreto');
    expect((await call(POST)).status).toBe(401);
    expect((await call(GET, 'Bearer otra')).status).toBe(401);
  });

  it('con la clave correcta pasa la autorización (falla recién al abrir la base mockeada)', async () => {
    vi.stubEnv('CRON_SECRET', 'secreto');
    const response = await call(POST, 'Bearer secreto');
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'sync_batch_failed' });
  });
});
