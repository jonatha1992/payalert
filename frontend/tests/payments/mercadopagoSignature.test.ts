import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyMercadoPagoSignature } from '@/lib/payments/mercadopagoSignature';

const secret = 'test-secret';
const sign = (manifest: string) => createHmac('sha256', secret).update(manifest).digest('hex');

const ts = '1742505638';
const requestId = 'bb56a2f1-6aae-46ac-982e-9dcd3581d08e';
const dataId = '123456';
const validHash = sign(`id:${dataId};request-id:${requestId};ts:${ts};`);

describe('verifyMercadoPagoSignature', () => {
  it('accepts a signature built from the documented manifest', () => {
    const result = verifyMercadoPagoSignature({
      xSignature: `ts=${ts},v1=${validHash}`,
      xRequestId: requestId,
      dataId,
      secret,
    });
    expect(result).toEqual({ ok: true });
  });

  it('tolerates spaces and key order in the header', () => {
    const result = verifyMercadoPagoSignature({
      xSignature: ` v1=${validHash} , ts=${ts} `,
      xRequestId: requestId,
      dataId,
      secret,
    });
    expect(result.ok).toBe(true);
  });

  it('lowercases alphanumeric data ids before signing', () => {
    const hash = sign(`id:abc123;request-id:${requestId};ts:${ts};`);
    const result = verifyMercadoPagoSignature({
      xSignature: `ts=${ts},v1=${hash}`,
      xRequestId: requestId,
      dataId: 'ABC123',
      secret,
    });
    expect(result.ok).toBe(true);
  });

  it('omits missing manifest parts', () => {
    const hash = sign(`id:${dataId};ts:${ts};`);
    const result = verifyMercadoPagoSignature({
      xSignature: `ts=${ts},v1=${hash}`,
      xRequestId: null,
      dataId,
      secret,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a body-HMAC style signature (the old implementation)', () => {
    const bodyHash = createHmac('sha256', secret).update('{"data":{"id":"123456"}}').digest('hex');
    const result = verifyMercadoPagoSignature({
      xSignature: `ts=${ts},v1=${bodyHash}`,
      xRequestId: requestId,
      dataId,
      secret,
    });
    expect(result).toEqual({ ok: false, reason: 'signature_mismatch' });
  });

  it('rejects when the secret is missing', () => {
    const result = verifyMercadoPagoSignature({
      xSignature: `ts=${ts},v1=${validHash}`,
      xRequestId: requestId,
      dataId,
      secret: '',
    });
    expect(result).toEqual({ ok: false, reason: 'missing_secret' });
  });

  it.each([
    [null, 'missing_signature'],
    ['', 'missing_signature'],
    ['garbage', 'malformed_signature'],
    [`v1=${validHash}`, 'missing_timestamp'],
    [`ts=abc,v1=${validHash}`, 'malformed_signature'],
    [`ts=${ts}`, 'missing_hash'],
  ])('rejects header %j as %s', (header, reason) => {
    const result = verifyMercadoPagoSignature({ xSignature: header, xRequestId: requestId, dataId, secret });
    expect(result).toEqual({ ok: false, reason });
  });

  it('enforces the timestamp tolerance when given', () => {
    const now = () => Number(ts) * 1000 + 10 * 60 * 1000;
    const result = verifyMercadoPagoSignature({
      xSignature: `ts=${ts},v1=${validHash}`,
      xRequestId: requestId,
      dataId,
      secret,
      toleranceSeconds: 300,
      now,
    });
    expect(result).toEqual({ ok: false, reason: 'timestamp_out_of_tolerance' });
  });

  it('accepts millisecond timestamps within tolerance', () => {
    const tsMs = '1742505638683';
    const hash = sign(`id:${dataId};request-id:${requestId};ts:${tsMs};`);
    const result = verifyMercadoPagoSignature({
      xSignature: `ts=${tsMs},v1=${hash}`,
      xRequestId: requestId,
      dataId,
      secret,
      toleranceSeconds: 300,
      now: () => Number(tsMs) + 1000,
    });
    expect(result.ok).toBe(true);
  });
});
