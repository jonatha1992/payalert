import type { MovementStatus, NormalizedTransaction } from './types';

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function identifier(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return text(value);
}

function pick(source: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(keys.filter((key) => Object.hasOwn(source, key)).map((key) => [key, source[key]]));
}

const mercadoPagoStatuses: Record<string, MovementStatus> = {
  approved: 'CONFIRMED', pending: 'PENDING', in_process: 'PENDING', authorized: 'PENDING',
  rejected: 'REJECTED', cancelled: 'REJECTED', refunded: 'REVERSED', charged_back: 'REVERSED',
};
const ualaStatuses: Record<string, MovementStatus> = {
  APPROVED: 'CONFIRMED', PROCESSED: 'CONFIRMED', PENDING: 'PENDING', REJECTED: 'REJECTED', REFUNDED: 'REVERSED',
};

function statusFor(status: unknown, statuses: Record<string, MovementStatus>): MovementStatus {
  return typeof status === 'string' && Object.hasOwn(statuses, status) ? statuses[status] : 'UNKNOWN';
}

/** Movimiento interno de saldo (account_money -> account_money): no es una venta ni un ingreso nuevo. */
export function isInternalMercadoPagoMovement(payment: unknown): boolean {
  const source = record(payment);
  return source.operation_type === 'money_transfer' && source.payment_type_id === 'account_money';
}

const mercadoPagoDescriptions: Record<string, string> = { 'Bank Transfer': 'Transferencia recibida' };
function mercadoPagoDescription(value: string | null): string | null {
  return value && Object.hasOwn(mercadoPagoDescriptions, value) ? mercadoPagoDescriptions[value] : value;
}

export function normalizeMercadoPagoPayment(payment: unknown): NormalizedTransaction {
  const source = record(payment);
  const externalId = identifier(source.id);
  const amount = source.transaction_amount;
  if (!externalId || typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new Error('Mercado Pago payment requires an id and a finite numeric amount');
  }
  const payer = record(source.payer);
  const identification = record(payer.identification);
  const payerName = [text(payer.first_name), text(payer.last_name)].filter(Boolean).join(' ') || null;
  const identificationType = text(identification.type);
  const identificationNumber = identifier(identification.number);
  return {
    provider: 'mercado_pago', externalId, providerAccountId: identifier(source.collector_id),
    direction: 'IN', amount, currency: text(source.currency_id) ?? 'ARS',
    status: statusFor(source.status, mercadoPagoStatuses),
    occurredAt: text(source.date_approved) ?? text(source.date_created) ?? '',
    payerName, payerIdentifier: identificationType && identificationNumber
      ? `${identificationType} ${identificationNumber}` : null,
    description: mercadoPagoDescription(text(source.description)), externalReference: text(source.external_reference),
    raw: pick(source, ['id', 'status', 'status_detail', 'payment_method_id', 'payment_type_id',
      'operation_type', 'date_created', 'date_approved', 'live_mode']),
  };
}

export function normalizeUalaOrder(order: unknown): NormalizedTransaction {
  const source = record(order);
  const externalId = identifier(source.uuid);
  const hasAmount = typeof source.amount === 'number' || text(source.amount) !== null;
  const amount = hasAmount ? Number(source.amount) : NaN;
  if (!externalId || !Number.isFinite(amount)) {
    throw new Error('Uala order requires a uuid and a finite amount');
  }
  return {
    provider: 'uala', externalId, providerAccountId: null, direction: 'IN', amount,
    currency: text(source.currency) ?? 'ARS', status: statusFor(source.status, ualaStatuses),
    occurredAt: text(source.updated_date) ?? text(source.created_date) ?? '',
    payerName: null, payerIdentifier: null, description: text(source.description),
    externalReference: text(source.external_reference),
    // GET examples use numeric amounts; whether these are units or cents is unverified.
    // Keep the reported value unchanged until the provider confirms the GET amount unit.
    raw: { ...pick(source, ['uuid', 'status', 'external_reference', 'created_date', 'updated_date']),
      amount_unit_unverified: true },
  };
}
