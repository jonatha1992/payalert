import { describe, expect, it } from 'vitest';

describe('configured Mercado Pago item title', () => {
  const itemTitle = (configured: string | null | undefined) => (configured?.trim() || 'Seña').slice(0, 120);

  it('uses the configured title', () => {
    expect(itemTitle('Cuota mensual')).toBe('Cuota mensual');
  });

  it('falls back to Seña when unset or blank', () => {
    expect(itemTitle(null)).toBe('Seña');
    expect(itemTitle('   ')).toBe('Seña');
  });
});
