import type { NormalizedTransaction } from './types';

export type PaymentKindCounts = Record<string, number>;

const FIELDS = ['operation_type', 'payment_type_id', 'payment_method_id'] as const;

/**
 * Cuenta cuántos pagos hay de cada tipo (operation_type / payment_type_id / payment_method_id).
 * Solo guarda el nombre del tipo, nunca datos de la persona. Sirve para ver si las
 * transferencias comunes aparecen en la consulta de pagos de Mercado Pago.
 */
export function tallyPaymentKinds(transactions: NormalizedTransaction[], into: PaymentKindCounts = {}): PaymentKindCounts {
  for (const transaction of transactions) {
    for (const field of FIELDS) {
      const value = transaction.raw?.[field];
      if (typeof value !== 'string' || !/^[a-z0-9_]{1,40}$/i.test(value)) continue;
      const key = `${field}:${value}`;
      into[key] = (into[key] ?? 0) + 1;
    }
  }
  return into;
}
