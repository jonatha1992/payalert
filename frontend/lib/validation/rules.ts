export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; fields: Record<string, string> };

export type Validator<T> = (input: unknown) => ValidationResult<T>;

const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;
const invalid = <T>(message: string): ValidationResult<T> => ({ ok: false, fields: { value: message } });

function textInput(input: unknown): string | null {
  return typeof input === 'string' && !CONTROL.test(input) ? input.trim() : null;
}

export function requiredText(min: number, max: number): Validator<string> {
  return (input) => {
    const value = textInput(input);
    if (value === null) return invalid('Ingresá un texto válido.');
    if (value.length < min) return invalid(`Ingresá al menos ${min} caracteres.`);
    if (value.length > max) return invalid(`No puede superar los ${max} caracteres.`);
    return { ok: true, value };
  };
}

export function optionalText(max: number): Validator<string | undefined> {
  return (input) => {
    if (input === undefined || input === null || input === '') return { ok: true, value: undefined };
    const value = textInput(input);
    if (value === null) return invalid('Ingresá un texto válido.');
    if (!value) return { ok: true, value: undefined };
    if (value.length > max) return invalid(`No puede superar los ${max} caracteres.`);
    return { ok: true, value };
  };
}

export const phoneAR: Validator<string | undefined> = (input) => {
  if (input === undefined || input === null || input === '') return { ok: true, value: undefined };
  if (typeof input !== 'string' || CONTROL.test(input)) return invalid('Ingresá un teléfono argentino válido.');
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, value: undefined };
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return invalid('Ingresá un teléfono argentino válido.');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 13) return invalid('El teléfono debe tener entre 8 y 13 dígitos.');
  return { ok: true, value: `${trimmed.startsWith('+') ? '+' : ''}${digits}` };
};

export const email: Validator<string> = (input) => {
  const value = textInput(input);
  if (value === null) return invalid('Ingresá un email válido.');
  const normalized = value.toLowerCase();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return invalid('Ingresá un email válido.');
  return { ok: true, value: normalized };
};

export const amount: Validator<number> = (input) => {
  let value: number;
  if (typeof input === 'number') value = input;
  else if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed || !/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2}|\.\d{1,2})?$/.test(trimmed)) return invalid('Ingresá un monto válido con hasta 2 decimales.');
    const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed;
    value = Number(normalized);
  } else return invalid('Ingresá un monto válido.');
  if (!Number.isFinite(value) || value <= 0 || value > 100_000_000 || Math.round(value * 100) !== value * 100) return invalid('El monto debe ser mayor a 0, tener hasta 2 decimales y no superar $100.000.000.');
  return { ok: true, value };
};

export const password: Validator<string> = (input) => {
  if (typeof input !== 'string' || CONTROL.test(input) || input.length < 8) return invalid('La contraseña debe tener al menos 8 caracteres.');
  return { ok: true, value: input };
};

export const uuid: Validator<string> = (input) => {
  if (typeof input !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input)) return invalid('Ingresá un identificador válido.');
  return { ok: true, value: input.toLowerCase() };
};

export function enumOf<const T extends readonly string[]>(values: T): Validator<T[number]> {
  return (input) => typeof input === 'string' && values.includes(input) ? { ok: true, value: input as T[number] } : invalid('Seleccioná una opción válida.');
}

export function dateRange(fromField: string, toField: string): Validator<Record<string, string>> {
  return (input) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, fields: { [fromField]: 'Ingresá un rango de fechas válido.' } };
    const record = input as Record<string, unknown>;
    const from = record[fromField];
    const to = record[toField];
    if (typeof from !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(from)) return { ok: false, fields: { [fromField]: 'Ingresá una fecha válida.' } };
    if (typeof to !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { ok: false, fields: { [toField]: 'Ingresá una fecha válida.' } };
    if (from > to) return { ok: false, fields: { [fromField]: 'La fecha desde no puede ser posterior a hasta.' } };
    return { ok: true, value: { [fromField]: from, [toField]: to } };
  };
}
