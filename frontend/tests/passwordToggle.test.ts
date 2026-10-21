import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { validationSchemas } from '@/lib/validation';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? tsxFiles(full) : full.endsWith('.tsx') ? [full] : [];
  });
}

describe('campos de contraseña', () => {
  it('FormField muestra un botón ojito accesible para type=password', () => {
    const src = read('components/FormField.tsx');
    expect(src).toContain("type === 'password'");
    expect(src).toContain('Mostrar contraseña');
    expect(src).toContain('Ocultar contraseña');
    expect(src).toContain('aria-pressed');
  });

  it('no queda ningún <input type="password"> suelto fuera de FormField', () => {
    const offenders = [...tsxFiles(join(root, 'app')), ...tsxFiles(join(root, 'components'))]
      .filter(f => !f.endsWith('FormField.tsx'))
      .filter(f => /<input[^>]*type=["']password["']/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('editar negocio valida el nombre con el esquema común', () => {
    expect(read('app/admin/businesses/[id]/edit/page.tsx')).toContain('validationSchemas.settings');
    expect(validationSchemas.settings({ name: '' }).ok).toBe(false);
    expect(validationSchemas.settings({ name: 'Kiosco Marta' }).ok).toBe(true);
  });
});
