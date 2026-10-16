import { describe, expect, it } from 'vitest';
import { cashierPaymentState } from '@/lib/payments/cashierState';
import type { ExpectedPaymentView } from '@/lib/server/expectedPayments';

const base: ExpectedPaymentView = { id: 'expected-1', businessId: 'biz', storeId: null, amount: 100, currency: 'ARS',
  reference: 'Mesa 4', status: 'WAITING', createdAt: '2026-10-16T10:00:00Z', expiresAt: '2026-10-16T10:15:00Z',
  provider: null, providerOrderId: null, checkoutUrl: null, match_candidates: [], matchedTransactionId: null,
  matchedAt: null, matchScore: null, matchCandidates: [] };

describe('cashier expected-to-received states', () => {
  it('shows a waiting charge as pending without claiming payment', () => {
    expect(cashierPaymentState(base)).toEqual({ label: 'Pendiente', received: false, needsReview: false });
  });
  it('shows an automatically matched authoritative payment as received', () => {
    expect(cashierPaymentState({ ...base, status: 'MATCHED' })).toEqual({ label: 'Recibido', received: true, needsReview: false });
  });
  it('routes ambiguous matching to manual review', () => {
    expect(cashierPaymentState({ ...base, status: 'MANUAL_REVIEW' })).toEqual({ label: 'Revisar: pago ambiguo', received: false, needsReview: true });
  });
});
