import { describe, expect, it } from 'vitest';
import { healthStatusForResult, safeHealthDetail } from '../../lib/payments/connectionHealth';

describe('connection health result mapping', () => {
  it('restores a connection after a successful check', () => {
    expect(healthStatusForResult({ ok: true })).toEqual({ status: 'CONNECTED', lastError: null });
  });

  it('requires reauthentication when provider credentials are rejected', () => {
    expect(healthStatusForResult({ ok: false, detail: 'invalid_token' })).toEqual({
      status: 'REAUTH_REQUIRED', lastError: 'invalid_token',
    });
  });

  it('marks temporary provider failures degraded and sanitizes diagnostic detail', () => {
    expect(healthStatusForResult({ ok: false, detail: 'provider_unavailable' })).toEqual({
      status: 'DEGRADED', lastError: 'provider_unavailable',
    });
    expect(safeHealthDetail('Authorization: Bearer token-secret-123')).toBe('health_check_failed');
  });

  it('retains a stable safe diagnostic for an unclassified failure', () => {
    expect(safeHealthDetail('connection timeout')).toBe('connection_timeout');
  });
});
