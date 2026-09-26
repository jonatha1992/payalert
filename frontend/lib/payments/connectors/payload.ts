import type { WebhookRequest } from '../types';

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

export function readWebhookBody(request: WebhookRequest): Record<string, unknown> | null {
  try {
    return asRecord(JSON.parse(request.rawBody));
  } catch {
    return null;
  }
}

export function asIdentifier(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return typeof value === 'string' && value.trim() ? value : null;
}

export function header(request: WebhookRequest, name: string): string | undefined {
  return Object.entries(request.headers).find(([key]) => key.toLowerCase() === name)?.[1];
}
