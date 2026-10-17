import { describe, expect, it } from 'vitest';
import { integrationCredentialSchemas } from '../lib/validation/integrations';

describe('integration credential validation', () => {
  it('normalizes Mercado Pago keys and permits an omitted webhook secret', () => {
    const result = integrationCredentialSchemas.mercadoPago({ accessToken: '  TEST-token-123  ', webhookSecret: '' });
    expect(result).toEqual({ ok: true, value: { accessToken: 'TEST-token-123', webhookSecret: '' } });
  });

  it('rejects short or whitespace-containing credentials', () => {
    expect(integrationCredentialSchemas.mercadoPago({ accessToken: 'abc def', webhookSecret: 'short' })).toMatchObject({
      ok: false,
      fields: { accessToken: expect.stringContaining('sin espacios'), webhookSecret: expect.stringContaining('al menos 8 caracteres') },
    });
  });

  it('requires Ualá Bis credentials and validates their length', () => {
    expect(integrationCredentialSchemas.uala({ username: '', clientId: 'short', clientSecretId: 'secret', environment: 'production' })).toMatchObject({
      ok: false,
      fields: { username: expect.any(String), clientId: expect.any(String), clientSecretId: expect.any(String) },
    });
  });
});
