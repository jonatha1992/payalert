import { describe, expect, it } from 'vitest';
import { validateForm } from '@/hooks/useFormValidation';
import { validationSchemas } from '@/lib/validation';

describe('client form validation', () => {
  it('returns field errors from the shared schema', () => {
    expect(validateForm(validationSchemas.store, { name: '   ', address: '', phone: '' })).toEqual({ name: 'Ingresá al menos 2 caracteres.' });
  });
  it('blocks invalid values and returns normalized data when valid', () => {
    expect(validationSchemas.store({ name: '', address: '', phone: '' }).ok).toBe(false);
    expect(validationSchemas.store({ name: '  Centro  ', address: ' Av. Siempre Viva  ', phone: '+54 (11) 1234-5678' })).toEqual({ ok: true, value: { name: 'Centro', address: 'Av. Siempre Viva', phone: '+541112345678' } });
  });
  it('allows an omitted phone and normalizes login email', () => {
    expect(validationSchemas.store({ name: 'Centro', address: '', phone: '' })).toEqual({ ok: true, value: { name: 'Centro' } });
    expect(validationSchemas.login({ email: '  User@Example.com ', password: 'password123' })).toEqual({ ok: true, value: { email: 'user@example.com', password: 'password123' } });
  });
  it('normalizes decimal amounts to a number', () => {
    expect(validationSchemas.expense({ amount: '1.234,50', category: 'Insumos', description: '  Insumos  ', store_id: '' })).toEqual({ ok: true, value: { amount: 1234.5, category: 'Insumos', description: 'Insumos' } });
  });
});
