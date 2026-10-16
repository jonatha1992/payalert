export interface ReportQuery {
  page: number;
  pageSize: number;
  search?: string;
  minAmount?: number;
  maxAmount?: number;
  status?: string;
  direction?: 'inbound' | 'outbound';
  currency?: string;
  provider?: string;
  accountId?: string;
}

const PAGE_SIZE_MAX = 100;
const STATUSES = new Set(['pending', 'completed', 'failed', 'cancelled', 'refunded']);

export function parseReportQuery(params: URLSearchParams): ReportQuery {
  const page = parseInteger(params, 'page', 1, 1, 1_000_000);
  const pageSize = parseInteger(params, 'pageSize', 50, 1, PAGE_SIZE_MAX);
  const minAmount = parseAmount(params, 'minAmount');
  const maxAmount = parseAmount(params, 'maxAmount');
  if (minAmount !== undefined && maxAmount !== undefined && minAmount > maxAmount) {
    throw new Error('minAmount no puede superar maxAmount');
  }

  const status = optionalText(params, 'status');
  if (status && !STATUSES.has(status)) throw new Error('status inválido');
  const directionRaw = optionalText(params, 'direction');
  const normalizedDirection = directionRaw === 'income' ? 'inbound' : directionRaw === 'expense' ? 'outbound' : directionRaw;
  if (normalizedDirection && normalizedDirection !== 'inbound' && normalizedDirection !== 'outbound') throw new Error('direction inválido');
  const direction: ReportQuery['direction'] = normalizedDirection === 'inbound' || normalizedDirection === 'outbound' ? normalizedDirection : undefined;

  return {
    page, pageSize,
    search: optionalText(params, 'search'), minAmount, maxAmount,
    status, direction, currency: optionalText(params, 'currency')?.toUpperCase(),
    provider: optionalText(params, 'provider'), accountId: optionalText(params, 'accountId'),
  };
}

function optionalText(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key)?.trim();
  if (!value) return undefined;
  if (value.length > 200) throw new Error(`${key} demasiado largo`);
  return value;
}

function parseInteger(params: URLSearchParams, key: string, fallback: number, min: number, max: number): number {
  const raw = params.get(key);
  if (raw === null) return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`${key} inválido`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    if (key === 'pageSize' && value > max) return max;
    throw new Error(`${key} fuera de rango`);
  }
  return value;
}

function parseAmount(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key);
  if (raw === null || raw === '') return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${key} inválido`);
  return value;
}
