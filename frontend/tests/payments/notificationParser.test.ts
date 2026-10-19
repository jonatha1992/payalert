import { describe, expect, it } from 'vitest';
import { parsePaymentNotification } from '@/lib/payments/notificationParser';

describe('parsePaymentNotification', () => {
  it('parses Argentine formatted amounts and payer names', () => {
    expect(parsePaymentNotification('Mercado Pago', 'Recibiste $1.234,56 de María Pérez')).toEqual({ amount: 1234.56, payerName: 'María Pérez' });
  });
  it('parses integer amount without assuming a payer', () => {
    expect(parsePaymentNotification('Recibiste $100', '')).toEqual({ amount: 100, payerName: null });
  });
  it.each(['Pagaste $1.234,56 a X', 'Recibiste una consulta', 'Recibiste $0 de X', 'Recibiste $100.000.000,01 de X'])('rejects non-income or invalid amount: %s', (text) => {
    expect(parsePaymentNotification('Mercado Pago', text)).toBeNull();
  });
});
