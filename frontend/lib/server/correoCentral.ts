import { logStructured } from '@/lib/server/structuredLog';

const DEFAULT_BASE_URL = 'https://correo.tecnofusion.dev';
const DEFAULT_TIMEOUT_MS = 5000;

export interface CorreoSendInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  idempotencyKey?: string;
}

export type CorreoSendResult =
  | { ok: true; id: string; from: string; status: string; replayed: boolean }
  | { ok: false; skipped: true; reason: 'not_configured' }
  | { ok: false; reason: 'http_error'; status: number }
  | { ok: false; reason: 'timeout' | 'network_error' };

export interface CorreoCentralClient {
  isConfigured(): boolean;
  send(input: CorreoSendInput): Promise<CorreoSendResult>;
}

export interface CorreoCentralClientOptions {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function normalizeBaseUrl(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim();
  return (trimmed || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

export function createCorreoCentralClient(options: CorreoCentralClientOptions = {}): CorreoCentralClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? process.env.CORREO_CENTRAL_URL);
  const apiKey = (options.apiKey ?? process.env.CORREO_CENTRAL_KEY ?? '').trim();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    isConfigured: () => apiKey.length > 0,

    async send(input: CorreoSendInput): Promise<CorreoSendResult> {
      if (!apiKey) {
        return { ok: false, skipped: true, reason: 'not_configured' };
      }

      const body: Record<string, string> = {
        to: input.to,
        subject: input.subject,
        text: input.text,
      };
      if (input.html) body.html = input.html;
      if (input.replyTo) body.replyTo = input.replyTo;
      if (input.idempotencyKey) body.idempotencyKey = input.idempotencyKey.slice(0, 128);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(`${baseUrl}/v1/send`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          logStructured('correo_central_http_error', { status: response.status });
          return { ok: false, reason: 'http_error', status: response.status };
        }

        const payload = await response.json() as {
          id?: string;
          from?: string;
          status?: string;
          replayed?: boolean;
        };
        return {
          ok: true,
          id: payload.id ?? '',
          from: payload.from ?? '',
          status: payload.status ?? 'sent',
          replayed: Boolean(payload.replayed),
        };
      } catch (error) {
        const isAbort = error instanceof Error && error.name === 'AbortError';
        logStructured('correo_central_request_failed', { reason: isAbort ? 'timeout' : 'network_error' });
        return { ok: false, reason: isAbort ? 'timeout' : 'network_error' };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

let defaultClient: CorreoCentralClient | null = null;

export function getCorreoCentralClient(): CorreoCentralClient {
  if (!defaultClient) {
    defaultClient = createCorreoCentralClient();
  }
  return defaultClient;
}
