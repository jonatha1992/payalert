import { describe, expect, it } from 'vitest';
import { tallyPaymentKinds } from '@/lib/payments/paymentKinds';
import type { NormalizedTransaction } from '@/lib/payments/types';

const tx = (raw: Record<string, unknown>): NormalizedTransaction => ({ provider: 'mercado_pago', externalId: '1',
  providerAccountId: null, direction: 'IN', amount: 1, currency: 'ARS', status: 'APPROVED' as never,
  occurredAt: '2026-10-18T00:00:00.000Z', payerName: 'Juan Pérez', payerIdentifier: '20123456789',
  description: null, externalReference: null, raw });

describe('tallyPaymentKinds', () => {
  it('cuenta los tipos de operación, de pago y de medio', () => {
    const result = tallyPaymentKinds([
      tx({ operation_type: 'money_transfer', payment_type_id: 'bank_transfer', payment_method_id: 'cvu' }),
      tx({ operation_type: 'regular_payment', payment_type_id: 'account_money', payment_method_id: 'account_money' }),
      tx({ operation_type: 'money_transfer', payment_type_id: 'bank_transfer', payment_method_id: 'cvu' }),
    ]);
    expect(result['operation_type:money_transfer']).toBe(2);
    expect(result['payment_type_id:bank_transfer']).toBe(2);
    expect(result['operation_type:regular_payment']).toBe(1);
  });

  it('no guarda datos de la persona ni valores raros', () => {
    const result = tallyPaymentKinds([tx({ operation_type: 'Juan Pérez 20123456789', payment_type_id: 42 })]);
    expect(Object.keys(result)).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('Juan');
  });

  it('acumula sobre un contador existente', () => {
    const acc = { 'operation_type:x': 1 };
    tallyPaymentKinds([tx({ operation_type: 'x' })], acc);
    expect(acc['operation_type:x']).toBe(2);
  });
});
