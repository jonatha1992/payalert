import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const frontendRoot = resolve(__dirname, '..');
const read = (path: string) => readFileSync(resolve(frontendRoot, path), 'utf8');

describe('páginas legales públicas', () => {
  it('incluye las páginas de privacidad y términos con correo de contacto', () => {
    const privacy = read('app/privacidad/page.tsx');
    const terms = read('app/terminos/page.tsx');

    expect(privacy).toContain('Política de privacidad');
    expect(terms).toContain('Condiciones del servicio');
    expect(privacy).toContain('tecnofusion.it@gmail.com');
    expect(terms).toContain('tecnofusion.it@gmail.com');
  });

  it('permite las rutas legales antes de comprobar la sesión', () => {
    const proxy = read('proxy.ts');
    const publicRouteCheck = proxy.indexOf("pathname === '/privacidad' || pathname === '/terminos'");
    const sessionLookup = proxy.indexOf('await supabase.auth.getUser()');

    expect(publicRouteCheck).toBeGreaterThanOrEqual(0);
    expect(sessionLookup).toBeGreaterThan(publicRouteCheck);
  });
});
