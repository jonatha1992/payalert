import { describe, expect, it } from 'vitest';
import { validateForm } from '../../hooks/useFormValidation';
import { validationSchemas } from '../../lib/validation';

describe('employee and expense form validation', () => {
  it('rejects employee data with field-specific Spanish errors and normalizes valid values', () => {
    const invalid = validateForm(validationSchemas.employee, {
      first_name: '', last_name: 'Pérez', email: 'no-es-email', password: 'corto', assigned_store_id: '',
    });
    expect(invalid).toMatchObject({
      first_name: expect.stringContaining('caracteres'),
      email: 'Ingresá un email válido.',
      password: 'La contraseña debe tener al menos 8 caracteres.',
    });
    const result = validationSchemas.employee({
      first_name: ' Ana ', last_name: ' Pérez ', email: 'ANA@EXAMPLE.COM', password: 'abcdefgh', assigned_store_id: '',
    });
    expect(result).toEqual({ ok: true, value: { first_name: 'Ana', last_name: 'Pérez', email: 'ana@example.com', password: 'abcdefgh' } });
  });

  it('rejects invalid expense amounts and returns a numeric normalized amount', () => {
    const invalid = validateForm(validationSchemas.expense, { amount: '0', category: 'Insumos', description: 'Compra', store_id: '' });
    expect(invalid.amount).toContain('mayor a 0');
    const result = validationSchemas.expense({ amount: '1.234,56', category: 'Insumos', description: ' Compra ', store_id: '' });
    expect(result).toEqual({ ok: true, value: { amount: 1234.56, category: 'Insumos', description: 'Compra' } });
  });
});
