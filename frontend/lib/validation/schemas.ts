import { amount, email, enumOf, optionalText, password, phoneAR, requiredText, uuid, type ValidationResult, type Validator } from './rules';

export type Schema = Validator<Record<string, unknown>>;
type Field = { validator: Validator<unknown>; optional?: boolean };

function schema(fields: Record<string, Field>): Schema {
  return (input) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, fields: { form: 'Ingresá datos válidos.' } };
    const source = input as Record<string, unknown>;
    const value: Record<string, unknown> = {};
    const errors: Record<string, string> = {};
    for (const [key, field] of Object.entries(fields)) {
      const result = field.validator(source[key]);
      if (!result.ok) {
        if (!(field.optional && (source[key] === undefined || source[key] === ''))) errors[key] = result.fields.value ?? 'Ingresá un valor válido.';
      } else if (result.value !== undefined) value[key] = result.value;
    }
    return Object.keys(errors).length ? { ok: false, fields: errors } : { ok: true, value };
  };
}

const text = (min: number, max: number) => requiredText(min, max) as Validator<unknown>;
const opt = (max: number) => optionalText(max) as Validator<unknown>;
const optionalPhone = phoneAR as Validator<unknown>;
const mail = email as Validator<unknown>;
const pass = password as Validator<unknown>;
const requiredPass: Validator<unknown> = (input) => typeof input === 'string' && input.length > 0
  ? { ok: true, value: input }
  : { ok: false, fields: { value: 'La contraseña es obligatoria.' } };
const money = amount as Validator<unknown>;
const storeCategories = enumOf(['Insumos', 'Mantenimiento', 'Salarios', 'Alquiler', 'Servicios', 'Otros'] as const) as Validator<unknown>;
const provider = enumOf(['mercado_pago', 'uala'] as const) as Validator<unknown>;
const environment = enumOf(['production', 'stage'] as const) as Validator<unknown>;
const optionalUuid = (input: unknown): ValidationResult<string | undefined> => input === '' || input === undefined ? { ok: true, value: undefined } : uuid(input);

export const validationSchemas = {
  store: schema({ name: { validator: text(2, 80) }, address: { validator: opt(200), optional: true }, phone: { validator: optionalPhone, optional: true } }),
  employee: schema({ first_name: { validator: text(1, 100) }, last_name: { validator: text(1, 100) }, email: { validator: mail }, password: { validator: pass }, assigned_store_id: { validator: optionalUuid, optional: true } }),
  expense: schema({ amount: { validator: money }, category: { validator: storeCategories }, description: { validator: text(1, 500) }, store_id: { validator: optionalUuid, optional: true } }),
  expectedCharge: schema({ amount: { validator: money }, reference: { validator: opt(120), optional: true }, connectionId: { validator: optionalUuid, optional: true } }),
  integrationMercadoPago: schema({ provider: { validator: provider }, storeId: { validator: optionalUuid, optional: true }, label: { validator: opt(120), optional: true }, accessToken: { validator: text(1, 4096) }, webhookSecret: { validator: opt(4096), optional: true } }),
  integrationUala: schema({ provider: { validator: provider }, storeId: { validator: optionalUuid, optional: true }, label: { validator: opt(120), optional: true }, username: { validator: text(1, 255) }, clientId: { validator: text(1, 255) }, clientSecretId: { validator: text(1, 4096) }, environment: { validator: environment } }),
  settings: schema({ name: { validator: text(1, 160) } }),
  login: schema({ email: { validator: mail }, password: { validator: requiredPass } }),
  newBusiness: schema({ name: { validator: text(1, 160) }, mpAccessToken: { validator: opt(4096), optional: true }, mpPublicKey: { validator: opt(1024), optional: true }, ualaClientId: { validator: opt(255), optional: true }, ualaClientSecret: { validator: opt(4096), optional: true } }),
  clientApp: schema({ slug: { validator: (input) => typeof input === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input) && input.length <= 50 ? { ok: true, value: input } : { ok: false, fields: { value: 'Usá minúsculas, números y guiones para el identificador.' } } }, business_id: { validator: uuid as Validator<unknown> }, connection_id: { validator: uuid as Validator<unknown> }, deposit_default: { validator: (input) => typeof input === 'number' && Number.isInteger(input) && input >= 1 && input <= 1000000 ? { ok: true, value: input } : { ok: false, fields: { value: 'El monto debe ser un entero entre 1 y 1.000.000.' } } }, item_title: { validator: text(1, 120) } }),
  clientAppAmount: schema({ deposit_default: { validator: (input) => typeof input === 'number' && Number.isInteger(input) && input >= 1 && input <= 1000000 ? { ok: true, value: input } : { ok: false, fields: { value: 'El monto debe ser un entero entre 1 y 1.000.000.' } } } }),
  clientAppTitle: schema({ item_title: { validator: text(1, 120) } }),
} satisfies Record<string, Schema>;
