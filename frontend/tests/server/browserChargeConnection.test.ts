import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
// La base guarda provider='mercado_pago' y status='CONNECTED'; antes se exigía 'mercadopago'/'active' y todo cobro daba not_connected.
describe('aceptación de conexiones MP reales', () => {
  for (const f of ['lib/server/browserCharge.ts', 'app/api/v1/charges/route.ts']) it(f, () => {
    const s = readFileSync(f, 'utf8');
    expect(s).toContain("'mercado_pago'"); expect(s).toContain("'connected'");
    expect(s).not.toContain("connection.provider !== 'mercadopago'");
  });
});
