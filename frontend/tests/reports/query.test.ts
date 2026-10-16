import { describe, expect, it } from 'vitest';
import { parseReportQuery } from '../../lib/reports/query';

describe('parseReportQuery', () => {
  it('validates supported filters and caps page size', () => {
    const result = parseReportQuery(new URLSearchParams('page=3&pageSize=500&search=foo&minAmount=10&maxAmount=20&status=completed&direction=inbound&currency=ARS&provider=mp&accountId=acct'));
    expect(result).toEqual({ page: 3, pageSize: 100, search: 'foo', minAmount: 10, maxAmount: 20, status: 'completed', direction: 'inbound', currency: 'ARS', provider: 'mp', accountId: 'acct' });
  });

  it('rejects malformed bounds, enums, and page values', () => {
    expect(() => parseReportQuery(new URLSearchParams('page=0'))).toThrow();
    expect(() => parseReportQuery(new URLSearchParams('minAmount=-1'))).toThrow();
    expect(() => parseReportQuery(new URLSearchParams('minAmount=20&maxAmount=10'))).toThrow();
    expect(() => parseReportQuery(new URLSearchParams('direction=sideways'))).toThrow();
  });
});
