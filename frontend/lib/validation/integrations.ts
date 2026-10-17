import type { Schema } from './schemas';

const credential = (label: string) => (input: unknown) => {
  const value = typeof input === 'string' ? input.trim() : '';
  if (!value || /\\s/.test(value) || value.length < 8 || value.length > 4096) {
    return { ok: false as const, fields: { value: `${label}: pegá una clave válida, de al menos 8 caracteres y sin espacios.` } };
  }
  return { ok: true as const, value };
};

const accessToken = credential('La clave de acceso');
const webhookSecret = (input: unknown) => input === '' || input === undefined
  ? { ok: true as const, value: '' }
  : credential('La clave secreta')(input);

const ualaValue = (input: unknown, field: string, max: number) => {
  const value = typeof input === 'string' ? input.trim() : '';
  if (!value || value.length < 8 || value.length > max || (field !== 'username' && /\\s/.test(value))) {
    return { ok: false as const, fields: { value: 'Completá este dato con el valor que te dio Ualá Bis, sin espacios.' } };
  }
  return { ok: true as const, value };
};

export const integrationCredentialSchemas: Record<'mercadoPago' | 'uala', Schema> = {
  mercadoPago: (input) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, fields: { form: 'Revisá los datos ingresados.' } };
    const values = input as Record<string, unknown>;
    const token = accessToken(values.accessToken);
    const secret = webhookSecret(values.webhookSecret);
    const fields: Record<string, string> = {};
    if (!token.ok) fields.accessToken = token.fields.value;
    if (!secret.ok) fields.webhookSecret = secret.fields.value;
    return Object.keys(fields).length
      ? { ok: false, fields }
      : { ok: true, value: { ...values, accessToken: token.value, webhookSecret: secret.value } };
  },
  uala: (input) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, fields: { form: 'Revisá los datos ingresados.' } };
    const values = input as Record<string, unknown>;
    const fields: Record<string, string> = {};
    for (const [field, max] of [['username', 255], ['clientId', 255], ['clientSecretId', 4096]] as const) {
      const result = ualaValue(values[field], field, max);
      if (!result.ok) fields[field] = result.fields.value;
    }
    return Object.keys(fields).length ? { ok: false, fields } : { ok: true, value: values };
  },
};

