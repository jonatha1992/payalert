import { describe, expect, it } from 'vitest';
import { matchTransaction, scoreCandidate } from '@/lib/payments/matching';
import type { ExpectedPayment, NormalizedTransaction } from '@/lib/payments/types';

const tx: NormalizedTransaction = { provider: 'mercado_pago', externalId: 'p', providerAccountId: 'a',
  direction: 'IN', amount: 100, currency: 'ARS', status: 'CONFIRMED', occurredAt: '2026-01-01T12:00:00Z',
  payerName: null, payerIdentifier: null, description: null, externalReference: null, raw: {} };
const expected: ExpectedPayment = { id: 'e', businessId: 'b', storeId: 's', amount: 100, currency: 'ARS',
  reference: null, status: 'WAITING', createdAt: '2026-01-01T12:01:00Z', expiresAt: '2026-01-01T12:30:00Z',
  provider: 'mercado_pago', providerOrderId: null, checkoutUrl: null, match_candidates: [] };

describe('matching', () => {
  it('adds the specified weights and includes both time boundaries', () => {
    expect(scoreCandidate(tx, expected, {})).toBe(110);
    expect(scoreCandidate({ ...tx, externalReference: 'e' }, expected, {})).toBe(120);
    for (const occurredAt of ['2026-01-01T11:59:00Z', expected.expiresAt]) {
      expect(scoreCandidate({ ...tx, occurredAt }, expected, {})).toBe(110);
    }
    expect(scoreCandidate({ ...tx, occurredAt: '2026-01-01T11:58:59Z' }, expected, {})).toBe(90);
    expect(scoreCandidate({ ...tx, amount: 100.004 }, expected, {})).toBe(110);
    expect(scoreCandidate({ ...tx, amount: 100.006 }, expected, {})).toBe(50);
  });

  it.each([
      [{}, 'AUTO', 110],
      [{ provider: null, createdAt: '2026-01-02', expiresAt: '2026-01-03' }, 'SUGGESTED', 70],
      [{ amount: 99 }, 'NO_MATCH', 50],
    ] as const)('applies score thresholds %j', (changes, decision, score) => {
      const baseExpected = { ...expected, ...changes };
      const result = matchTransaction(tx, [baseExpected], {});
      expect(result.decision).toBe(decision);
      if (decision !== 'NO_MATCH') {
        expect(result.expectedPaymentId).toBe('e');
      }
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].score).toBe(score);
      expect(result.candidates[0].amount).toBe(baseExpected.amount);
      expect(result.candidates[0].currency).toBe(baseExpected.currency);
    });

  it('requires manual review when more than one candidate scores at least 70', () => {
    expect(matchTransaction(tx, [expected, { ...expected, id: 'e2', provider: null }], {}).decision)
      .toBe('MANUAL_REVIEW');
  });

  it('makes an exact reference definitive even with ambiguity or a low score', () => {
    expect(matchTransaction({ ...tx, externalReference: 'e2' }, [expected,
      { ...expected, id: 'e2', amount: 1, currency: 'USD', provider: null,
        createdAt: '2027-01-01', expiresAt: '2027-01-02' }], {}))
      .toMatchObject({ decision: 'AUTO', expectedPaymentId: 'e2' });
  });

  it('excludes non-WAITING candidates, including reference matches, without mutating inputs', () => {
    const candidates = Object.freeze([Object.freeze({ ...expected, status: 'MATCHED' as const })]);
    expect(scoreCandidate(tx, candidates[0], {})).toBe(0);
    expect(matchTransaction({ ...tx, externalReference: 'e' }, candidates, {}))
      .toEqual({ decision: 'NO_MATCH', candidates: [] });
  });
});
