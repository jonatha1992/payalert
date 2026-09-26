import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Mercado Pago webhook signature check.
 *
 * Mirrors the official SDK validator (mercadopago/sdk-nodejs, src/utils/webhook):
 * HMAC-SHA256(secret, "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"),
 * where missing parts are omitted. The docs ask to lowercase alphanumeric ids,
 * the SDK signs the id as received, so both forms are accepted.
 *
 * QR Code notifications are not signed by Mercado Pago.
 */

export type SignatureFailureReason =
  | 'missing_secret'
  | 'missing_signature'
  | 'malformed_signature'
  | 'missing_timestamp'
  | 'missing_hash'
  | 'signature_mismatch'
  | 'timestamp_out_of_tolerance';

export type SignatureResult = { ok: true } | { ok: false; reason: SignatureFailureReason };

export interface VerifyMercadoPagoSignatureInput {
  xSignature: string | null | undefined;
  xRequestId: string | null | undefined;
  dataId: string | null | undefined;
  secret: string | null | undefined;
  toleranceSeconds?: number;
  now?: () => number;
}

function clean(value: string | null | undefined): string | undefined {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildManifest(dataId: string | undefined, requestId: string | undefined, ts: string): string {
  const parts: string[] = [];
  if (dataId) parts.push(`id:${dataId}`);
  if (requestId) parts.push(`request-id:${requestId}`);
  parts.push(`ts:${ts}`);
  return `${parts.join(';')};`;
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b.toLowerCase());
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyMercadoPagoSignature(input: VerifyMercadoPagoSignatureInput): SignatureResult {
  const secret = clean(input.secret);
  if (!secret) return { ok: false, reason: 'missing_secret' };

  const header = clean(input.xSignature);
  if (!header) return { ok: false, reason: 'missing_signature' };

  let ts: string | undefined;
  const hashes: Record<string, string> = {};
  for (const part of header.split(',')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const value = part.slice(eq + 1).trim();
    if (!key || !value) continue;
    if (key === 'ts') ts = value;
    else if (/^v\d+$/.test(key)) hashes[key] = value;
  }

  if (!ts && Object.keys(hashes).length === 0) return { ok: false, reason: 'malformed_signature' };
  if (!ts) return { ok: false, reason: 'missing_timestamp' };
  if (!/^\d+$/.test(ts)) return { ok: false, reason: 'malformed_signature' };

  const received = hashes.v1;
  if (!received) return { ok: false, reason: 'missing_hash' };

  const requestId = clean(input.xRequestId);
  const dataId = clean(input.dataId);
  const candidates = new Set<string | undefined>([dataId, dataId?.toLowerCase()]);

  const matches = [...candidates].some((id) => {
    const computed = createHmac('sha256', secret).update(buildManifest(id, requestId, ts)).digest('hex');
    return safeEqualHex(computed, received);
  });
  if (!matches) return { ok: false, reason: 'signature_mismatch' };

  if (input.toleranceSeconds !== undefined) {
    const now = (input.now ?? Date.now)();
    const tsNumber = Number(ts);
    // Mercado Pago examples use milliseconds; the SDK comments say seconds. Accept both.
    const tsMs = tsNumber > 1e12 ? tsNumber : tsNumber * 1000;
    if (Math.abs(now - tsMs) / 1000 > input.toleranceSeconds) {
      return { ok: false, reason: 'timestamp_out_of_tolerance' };
    }
  }

  return { ok: true };
}
