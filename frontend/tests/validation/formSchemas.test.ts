import { describe, expect, it } from 'vitest';
import { validationSchemas } from '../../lib/validation';

describe('form validation schemas', () => {
  it('accepts optional blank store phone and normalizes supplied values', () => {
    expect(validationSchemas.store({ name: ' Centro ', address: ' Calle 1 ', phone: '' })).toEqual({
      ok: true,
      value: { name: 'Centro', address: 'Calle 1' },
    });
    expect(validationSchemas.store({ name: 'Centro', phone: ' +54 9 11 1234-5678 ' })).toEqual({
      ok: true,
      value: { name: 'Centro', phone: '+5491112345678' },
    });
  });

  it('enforces store name and address limits', () => {
    expect(validationSchemas.store({ name: 'A' })).toMatchObject({ ok: false, fields: { name: 'Ingresá al menos 2 caracteres.' } });
    expect(validationSchemas.store({ name: 'a'.repeat(81) })).toMatchObject({ ok: false, fields: { name: 'No puede superar los 80 caracteres.' } });
    expect(validationSchemas.store({ name: 'Centro', address: 'a'.repeat(201) })).toMatchObject({ ok: false, fields: { address: 'No puede superar los 200 caracteres.' } });
  });

  it('normalizes business emails and permits any non-empty login password', () => {
    expect(validationSchemas.login({ email: ' USER@Example.COM ', password: 'short' })).toEqual({ ok: true, value: { email: 'user@example.com', password: 'short' } });
    expect(validationSchemas.login({ email: 'invalid', password: '' })).toMatchObject({ ok: false, fields: { email: 'Ingresá un email válido.', password: 'La contraseña es obligatoria.' } });
  });

  it('requires at least eight characters for new employee passwords', () => {
    expect(validationSchemas.employee({ first_name: 'Ana', last_name: 'Pérez', email: 'ana@example.com', password: 'short' })).toMatchObject({ ok: false, fields: { password: 'La contraseña debe tener al menos 8 caracteres.' } });
  });
});
