import { describe, expect, it } from 'vitest';
import { localDateBoundaryUtc, localDateKey } from '../../lib/reports/dateRange';

describe('Argentina report date boundaries', () => {
  it('translates inclusive local day bounds to exact UTC instants', () => {
    expect(localDateBoundaryUtc('2026-10-15')).toBe('2026-10-15T03:00:00.000Z');
    expect(localDateBoundaryUtc('2026-10-15', true)).toBe('2026-10-16T03:00:00.000Z');
  });

  it('rejects malformed and impossible calendar dates', () => {
    expect(() => localDateBoundaryUtc('15-10-2026')).toThrow('Fecha inválida');
    expect(() => localDateBoundaryUtc('2026-02-30')).toThrow('Fecha inválida');
  });

  it('groups UTC instants by the Argentine calendar date', () => {
    expect(localDateKey('2026-10-15T02:59:59.999Z')).toBe('2026-10-14');
    expect(localDateKey('2026-10-15T03:00:00.000Z')).toBe('2026-10-15');
  });
});
