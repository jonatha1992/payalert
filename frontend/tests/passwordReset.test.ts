import { describe, expect, it } from 'vitest';
import { isPasswordResetRoutePublic, PASSWORD_RESET_SENT_MESSAGE, validatePasswordReset } from '../lib/passwordReset';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('password reset helpers', () => {
  it('requires at least 8 characters and a matching confirmation', () => {
    expect(validatePasswordReset('short', 'short')).toEqual({ password: 'La contraseña debe tener al menos 8 caracteres.' });
    expect(validatePasswordReset('long-enough', 'different')).toEqual({ confirmPassword: 'Las contraseñas no coinciden.' });
    expect(validatePasswordReset('long-enough', 'long-enough')).toEqual({});
  });

  it('uses a generic Spanish success message', () => {
    expect(PASSWORD_RESET_SENT_MESSAGE).toBe('Si el correo existe, te enviamos un enlace');
  });

  it('keeps both recovery routes public in proxy.ts', () => {
    const source = readFileSync(resolve(__dirname, '../proxy.ts'), 'utf8');
    expect(isPasswordResetRoutePublic(source)).toBe(true);
  });
});
