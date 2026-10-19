import { describe, expect, it } from 'vitest';
import { normalizeMercadoPagoPayment, normalizeUalaOrder } from '@/lib/payments/normalize';

describe('payment normalization', () => {
  it.each([
    ['approved', 'CONFIRMED'], ['pending', 'PENDING'], ['in_process', 'PENDING'],
    ['authorized', 'PENDING'], ['rejected', 'REJECTED'], ['cancelled', 'REJECTED'],
    ['refunded', 'REVERSED'], ['charged_back', 'REVERSED'], ['new_status', 'UNKNOWN'],
  ])('maps Mercado Pago %s to %s', (status, expected) => {
    expect(normalizeMercadoPagoPayment({ id: 12, transaction_amount: 100, status }).status).toBe(expected);
  });

  it('normalizes Mercado Pago fields and keeps only allowlisted raw fields', () => {
    const tx = normalizeMercadoPagoPayment({
      id: 12, transaction_amount: 0, currency_id: 'USD', collector_id: 55,
      date_created: '2026-01-01', date_approved: '2026-01-02', external_reference: 'expected',
      description: 'Purchase', payer: { first_name: 'Ada', last_name: 'Lovelace',
        email: 'private@example.com', identification: { type: 'DNI', number: '123' } },
      status: 'approved', status_detail: 'accredited', payment_method_id: 'visa',
      payment_type_id: 'credit_card', operation_type: 'regular_payment', live_mode: true,
      access_token: 'private-token', metadata: { secret: 'private-secret' },
    });
    expect(tx).toMatchObject({ provider: 'mercado_pago', externalId: '12', amount: 0, currency: 'USD',
      providerAccountId: '55', occurredAt: '2026-01-02', direction: 'IN', payerName: 'Ada Lovelace',
      payerIdentifier: 'DNI 123', externalReference: 'expected', description: 'Purchase' });
    expect(tx.raw).toEqual({ id: 12, status: 'approved', status_detail: 'accredited',
      payment_method_id: 'visa', payment_type_id: 'credit_card', operation_type: 'regular_payment',
      date_created: '2026-01-01', date_approved: '2026-01-02', live_mode: true });
  });

  it('defaults optional fields and never substitutes payer email for identification', () => {
    expect(normalizeMercadoPagoPayment({ id: 'p', transaction_amount: 2, date_created: 'created',
      payer: { email: 'private@example.com' } })).toMatchObject({ currency: 'ARS', occurredAt: 'created',
      providerAccountId: null, payerName: null, payerIdentifier: null, externalReference: null });
    expect(normalizeMercadoPagoPayment({ id: 'p', transaction_amount: 2,
      payer: { last_name: 'Solo' } }).payerName).toBe('Solo');
  });

  it.each([null, {}, { id: 1 }, { transaction_amount: 1 }, { id: '', transaction_amount: 1 },
    { id: 1, transaction_amount: null }, { id: 1, transaction_amount: '10' },
    { id: 1, transaction_amount: NaN }, { id: 1, transaction_amount: Infinity }])(
    'rejects malformed Mercado Pago payment %j', (value) => {
      expect(() => normalizeMercadoPagoPayment(value)).toThrow();
    });

  it.each([['APPROVED', 'CONFIRMED'], ['PROCESSED', 'CONFIRMED'], ['PENDING', 'PENDING'],
    ['REJECTED', 'REJECTED'], ['REFUNDED', 'REVERSED'], ['other', 'UNKNOWN']])(
    'maps Uala %s to %s without guessing amount units', (status, expected) => {
      const tx = normalizeUalaOrder({ uuid: 'order', amount: 1001, status, created_date: 'created',
        updated_date: 'updated', external_reference: 'expected', secret: 'private' });
      expect(tx).toMatchObject({ provider: 'uala', externalId: 'order', amount: 1001,
        status: expected, occurredAt: 'updated', providerAccountId: null, direction: 'IN',
        externalReference: 'expected', currency: 'ARS', payerName: null, payerIdentifier: null });
      expect(tx.raw).toEqual({ uuid: 'order', status, external_reference: 'expected',
        created_date: 'created', updated_date: 'updated', amount_unit_unverified: true });
    });

  it('accepts numeric Uala strings as-is and falls back to creation date', () => {
    expect(normalizeUalaOrder({ uuid: 'order', amount: '10.90', created_date: 'created' }))
      .toMatchObject({ amount: 10.9, occurredAt: 'created' });
  });

  it.each([{}, { uuid: 'o' }, { uuid: 'o', amount: null }, { uuid: 'o', amount: '' },
    { uuid: 'o', amount: false }, { uuid: 'o', amount: 'bad' }])('rejects malformed Uala order %j', (value) => {
      expect(() => normalizeUalaOrder(value)).toThrow();
    });
});

describe('movimientos internos de Mercado Pago', () => {
  it('detecta el espejo interno money_transfer/account_money y no el ingreso por CVU', async () => {
    const { isInternalMercadoPagoMovement } = await import('@/lib/payments/normalize');
    expect(isInternalMercadoPagoMovement({ operation_type: 'money_transfer', payment_type_id: 'account_money' })).toBe(true);
    expect(isInternalMercadoPagoMovement({ operation_type: 'account_fund', payment_type_id: 'bank_transfer' })).toBe(false);
    expect(isInternalMercadoPagoMovement({ operation_type: 'regular_payment', payment_type_id: 'credit_card' })).toBe(false);
  });

  it('muestra "Bank Transfer" en español', async () => {
    const { normalizeMercadoPagoPayment } = await import('@/lib/payments/normalize');
    expect(normalizeMercadoPagoPayment({ id: 1, transaction_amount: 100, description: 'Bank Transfer' }).description).toBe('Transferencia recibida');
  });
});
