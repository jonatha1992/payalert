import { describe, expect, it } from 'vitest';
import { amount, dateRange, email, enumOf, optionalText, password, phoneAR, requiredText, uuid } from '../../lib/validation';

describe('requiredText', () => {
  const validate = requiredText(2, 4);
  it('trims and accepts exact minimum and maximum lengths', () => {
    expect(validate(' ab ')).toEqual({ ok: true, value: 'ab' });
    expect(validate('abcd').ok).toBe(true);
  });
  it('rejects missing, overlong and control-character text', () => {
    expect(validate('a').ok).toBe(false);
    expect(validate('abcde').ok).toBe(false);
    expect(validate('ab\n').ok).toBe(false);
  });
});

describe('optionalText', () => {
  it('normalizes empty to undefined and enforces max length', () => {
    expect(optionalText(3)('  ')).toEqual({ ok: true, value: undefined });
    expect(optionalText(3)('abc').ok).toBe(true);
    expect(optionalText(3)('abcd').ok).toBe(false);
  });
});

describe('phoneAR', () => {
  it.each([
    ['+54 9 11 1234-5678', '+5491112345678'],
    ['011 4444-5555', '01144445555'],
    ['15 5555-5555', '1555555555'],
  ])('normalizes %s', (input, expected) => expect(phoneAR(input)).toEqual({ ok: true, value: expected }));
  it('allows empty and rejects invalid or wrong-length numbers', () => {
    expect(phoneAR('')).toEqual({ ok: true, value: undefined });
    expect(phoneAR('abc').ok).toBe(false);
    expect(phoneAR('123').ok).toBe(false);
  });
});

describe('email', () => {
  it('trims and lowercases valid email', () => expect(email(' User@Example.COM ')).toEqual({ ok: true, value: 'user@example.com' }));
  it.each(['bad', 'a@b', 'a b@example.com', `${'a'.repeat(243)}@example.com`])('rejects %s', (input) => expect(email(input).ok).toBe(false));
});

describe('amount', () => {
  it.each([['1.234,56', 1234.56], ['1234.56', 1234.56], [1.25, 1.25], ['100000000', 100000000]])('parses %s', (input, expected) => expect(amount(input)).toEqual({ ok: true, value: expected }));
  it.each(['0', '-5', '1e9', '12.345', NaN, Infinity, '100000000.01'])('rejects %s', input => expect(amount(input).ok).toBe(false));
});

describe('password, uuid, enumOf, and dateRange', () => {
  it('requires 8 password characters', () => {
    expect(password('12345678').ok).toBe(true);
    expect(password('1234567').ok).toBe(false);
  });
  it('validates and normalizes UUID', () => {
    expect(uuid('550E8400-E29B-41D4-A716-446655440000')).toEqual({ ok: true, value: '550e8400-e29b-41d4-a716-446655440000' });
    expect(uuid('nope').ok).toBe(false);
  });
  it('restricts enum values', () => {
    expect(enumOf(['a', 'b'] as const)('a').ok).toBe(true);
    expect(enumOf(['a', 'b'] as const)('c').ok).toBe(false);
  });
  it('accepts ordered date ranges and rejects reversed dates', () => {
    expect(dateRange('desde', 'hasta')({ desde: '2025-01-01', hasta: '2025-01-02' }).ok).toBe(true);
    expect(dateRange('desde', 'hasta')({ desde: '2025-01-03', hasta: '2025-01-02' }).ok).toBe(false);
  });
});
