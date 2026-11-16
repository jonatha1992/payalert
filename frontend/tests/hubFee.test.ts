import { describe, expect, it } from 'vitest';
import { computeFee } from '../lib/server/hubFee';

describe('computeFee', () => {
  it('defaults to a fixed fee of one', () => {
    expect(computeFee(10, undefined, undefined)).toEqual({ fee: 1 });
  });

  it('rounds percentage fees to two decimals', () => {
    expect(computeFee(19.99, 'percent', 2.5)).toEqual({ fee: 0.5 });
  });

  it('rejects a fee equal to or greater than the charge', () => {
    expect(computeFee(10, 'fixed', 10)).toEqual({ error: 'La comisión no puede ser igual o mayor al monto' });
    expect(computeFee(10, 'fixed', 11)).toEqual({ error: 'La comisión no puede ser igual o mayor al monto' });
  });

  it('allows a zero fee', () => {
    expect(computeFee(10, 'fixed', 0)).toEqual({ fee: 0 });
  });
});
