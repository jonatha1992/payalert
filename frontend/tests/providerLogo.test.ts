import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('ProviderLogo', () => {
  it('dibuja el isotipo de Mercado Pago y no solo el texto MP', () => {
    const src = readFileSync(join(__dirname, '..', 'components/ProviderLogo.tsx'), 'utf8');
    expect(src).toContain('MP_PATH');
    expect(src).toMatch(/provider === "mercadopago"/);
  });
});

describe('ProviderLogo Ualá', () => {
  it('usa el isotipo de Ualá y el archivo existe', () => {
    const src = readFileSync(join(__dirname, '..', 'components/ProviderLogo.tsx'), 'utf8');
    expect(src).toContain('/providers/uala.png');
    expect(readFileSync(join(__dirname, '..', 'public/providers/uala.png')).length).toBeGreaterThan(500);
  });
});
