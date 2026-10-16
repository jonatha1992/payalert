import type { ExpectedPaymentStatus } from './types';

export interface CashierPaymentState {
  label: string;
  received: boolean;
  needsReview: boolean;
}

export function cashierPaymentState(payment: { status: ExpectedPaymentStatus }): CashierPaymentState {
  if (payment.status === 'MATCHED') return { label: 'Recibido', received: true, needsReview: false };
  if (payment.status === 'MANUAL_REVIEW') return { label: 'Revisar: pago ambiguo', received: false, needsReview: true };
  if (payment.status === 'WAITING') return { label: 'Pendiente', received: false, needsReview: false };
  return { label: payment.status === 'EXPIRED' ? 'Vencido' : 'Cancelado', received: false, needsReview: false };
}
