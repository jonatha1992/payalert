import { describe, expect, it } from 'vitest';
import { validationSchemas } from '../../lib/validation';

describe('schemas', () => {
  const fixtures: Record<string, Record<string, unknown>> = {
    store: { name: 'Centro' },
    employee: { first_name: 'Ana', last_name: 'Pérez', email: 'ana@example.com', password: 'abcdefgh' },
    expense: { amount: '1.234,56', category: 'Insumos', description: 'Compra' },
    expectedCharge: { amount: '1234.56' },
    integrationMercadoPago: { provider: 'mercado_pago', accessToken: 'token' },
    integrationUala: { provider: 'uala', username: 'user', clientId: 'id', clientSecretId: 'secret', environment: 'production' },
    settings: { name: 'Negocio' },
    login: { email: 'ana@example.com', password: 'abcdefgh' },
    newBusiness: { name: 'Negocio' },
    adminUserRole: { systemRole: 'user', businessRole: 'owner', business_id: '550e8400-e29b-41d4-a716-446655440000' },
    clientApp: { name: 'App cliente' },
    clientAppAmount: { deposit_default: 5000 },
    clientAppTitle: { item_title: 'Reserva' },
  };
  it.each(Object.entries(validationSchemas))('%s accepts required fields', (name, schema) => {
    expect(schema(fixtures[name]).ok).toBe(true);
  });
  it.each(Object.entries(validationSchemas))('%s rejects missing fields in Spanish', (name, schema) => {
    const result = schema({});
    expect(result.ok, name).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.fields).length).toBeGreaterThan(0);
      expect(Object.values(result.fields).every(message => message.length > 0)).toBe(true);
    }
  });
  it('does not accept business_id or user_id as schema input fields', () => {
    for (const schema of Object.values(validationSchemas)) {
      expect(schema({ business_id: '550e8400-e29b-41d4-a716-446655440000', user_id: '550e8400-e29b-41d4-a716-446655440000' }).ok).toBe(false);
    }
  });
});
