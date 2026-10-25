export const PASSWORD_RESET_SENT_MESSAGE = 'Si el correo existe, te enviamos un enlace';

export function validatePasswordReset(password: string, confirmation: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (password.length < 8) errors.password = 'La contraseña debe tener al menos 8 caracteres.';
  if (password !== confirmation) errors.confirmPassword = 'Las contraseñas no coinciden.';
  return errors;
}

export function isPasswordResetRoutePublic(proxySource: string): boolean {
  return /pathname\s*===\s*'\/forgot-password'/.test(proxySource)
    && /pathname\s*===\s*'\/reset-password'/.test(proxySource);
}
