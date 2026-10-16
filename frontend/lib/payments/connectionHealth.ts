import type { ConnectionStatus } from './types';

export interface HealthCheckResult {
  ok: boolean;
  detail?: string;
  category?: 'reauth_required' | 'degraded' | 'error';
}

export function safeHealthDetail(detail: string | undefined): string {
  if (!detail || /bearer\s+\S+|access[_ -]?token|client[_ -]?secret|password|secret/i.test(detail)) {
    return 'health_check_failed';
  }
  const safe = detail.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
  return safe || 'health_check_failed';
}

export function healthStatusForResult(result: HealthCheckResult): {
  status: ConnectionStatus;
  lastError: string | null;
} {
  if (result.ok) return { status: 'CONNECTED', lastError: null };
  const category = result.category ?? (
    result.detail === 'invalid_token' || result.detail === 'unauthorized' ? 'reauth_required'
      : result.detail === 'provider_unavailable' || result.detail === 'request_failed' ? 'degraded' : 'error'
  );
  const status: ConnectionStatus = category === 'reauth_required'
    ? 'REAUTH_REQUIRED'
    : category === 'degraded' ? 'DEGRADED' : 'ERROR';
  return { status, lastError: safeHealthDetail(result.detail) };
}
