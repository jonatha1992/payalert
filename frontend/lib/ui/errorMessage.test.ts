import { describe, expect, it } from 'vitest';
import { friendlyErrorMessage } from './errorMessage';

describe('friendlyErrorMessage', () => {
  it.each([
    [{ status: 401 }, 'Tu sesión venció. Volvé a ingresar e intentá de nuevo.'],
    [{ status: 403 }, 'No tenés permiso para hacer esta acción.'],
    [{ status: 409 }, 'Ya existe un registro con esos datos.'],
    [{ status: 400 }, 'Revisá los datos ingresados e intentá de nuevo.'],
  ])('translates server status %s', (error, expected) => {
    expect(friendlyErrorMessage(error)).toBe(expected);
  });
  it('uses the provided friendly fallback for unknown errors', () => {
    expect(friendlyErrorMessage(new Error('secret stack details'), 'No se pudo eliminar.')).toBe('No se pudo eliminar.');
  });
});
