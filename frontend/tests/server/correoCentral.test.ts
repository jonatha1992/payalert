import { describe, expect, it, vi } from 'vitest';
import { createCorreoCentralClient } from '@/lib/server/correoCentral';

describe('correoCentral client', () => {
  it('returns skipped without calling fetch when apiKey is missing', async () => {
    const fetchMock = vi.fn();
    const client = createCorreoCentralClient({
      baseUrl: 'https://correo.tecnofusion.dev',
      apiKey: '',
      fetchImpl: fetchMock,
    });

    expect(client.isConfigured()).toBe(false);
    const result = await client.send({
      to: 'dest@ejemplo.com',
      subject: 'Prueba',
      text: 'Hola',
    });

    expect(result).toEqual({ ok: false, skipped: true, reason: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts JSON payload with Bearer auth to /v1/send and returns response id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ id: 're_123', from: 'PayAlert <avisos@tecnofusion.dev>', status: 'sent', replayed: false }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    const client = createCorreoCentralClient({
      baseUrl: 'https://correo.tecnofusion.dev/',
      apiKey: 'cc_secret_test_key',
      fetchImpl: fetchMock,
    });

    expect(client.isConfigured()).toBe(true);
    const result = await client.send({
      to: 'dest@ejemplo.com',
      subject: 'Nuevo pago',
      text: 'Recibiste un pago',
      html: '<p>Recibiste un pago</p>',
      idempotencyKey: 'pay-1',
    });

    expect(result).toEqual({
      ok: true,
      id: 're_123',
      from: 'PayAlert <avisos@tecnofusion.dev>',
      status: 'sent',
      replayed: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://correo.tecnofusion.dev/v1/send');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      Authorization: 'Bearer cc_secret_test_key',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(init.body)).toEqual({
      to: 'dest@ejemplo.com',
      subject: 'Nuevo pago',
      text: 'Recibiste un pago',
      html: '<p>Recibiste un pago</p>',
      idempotencyKey: 'pay-1',
    });
  });

  it('handles HTTP errors without throwing and never logs the api key', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const secret = 'cc_never_log_this_key_123456';
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: 'cuota alcanzada' }),
      { status: 429 },
    ));
    const client = createCorreoCentralClient({
      baseUrl: 'https://correo.tecnofusion.dev',
      apiKey: secret,
      fetchImpl: fetchMock,
    });

    const result = await client.send({
      to: 'dest@ejemplo.com',
      subject: 'Prueba',
      text: 'Hola',
    });

    expect(result).toEqual({ ok: false, reason: 'http_error', status: 429 });
    const logged = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logged).not.toContain(secret);
    expect(logged).not.toContain('dest@ejemplo.com');
    errorSpy.mockRestore();
  });

  it('aborts and returns timeout when request exceeds timeoutMs', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    }));
    const client = createCorreoCentralClient({
      baseUrl: 'https://correo.tecnofusion.dev',
      apiKey: 'cc_secret_timeout',
      timeoutMs: 25,
      fetchImpl: fetchMock,
    });

    const result = await client.send({
      to: 'dest@ejemplo.com',
      subject: 'Prueba',
      text: 'Hola',
    });

    expect(result).toEqual({ ok: false, reason: 'timeout' });
    const logged = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logged).not.toContain('cc_secret_timeout');
    errorSpy.mockRestore();
  });
});
