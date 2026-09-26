import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
  SecretBoxError,
} from '@/lib/payments/secretBox';

const key = randomBytes(32).toString('base64');

describe('secretBox', () => {
  it('round-trips a secret', () => {
    const sealed = encryptSecret('APP_USR-123', key);
    expect(sealed.startsWith('enc:v1:')).toBe(true);
    expect(sealed).not.toContain('APP_USR-123');
    expect(decryptSecret(sealed, key)).toBe('APP_USR-123');
  });

  it('uses a fresh IV per call', () => {
    expect(encryptSecret('same', key)).not.toBe(encryptSecret('same', key));
  });

  it('rejects tampered ciphertext', () => {
    const sealed = encryptSecret('secret', key);
    const parts = sealed.split(':');
    const ct = Buffer.from(parts[4], 'base64');
    ct[0] ^= 0xff;
    parts[4] = ct.toString('base64');
    expect(() => decryptSecret(parts.join(':'), key)).toThrow(SecretBoxError);
  });

  it('rejects a wrong key', () => {
    const sealed = encryptSecret('secret', key);
    expect(() => decryptSecret(sealed, randomBytes(32).toString('base64'))).toThrow(SecretBoxError);
  });

  it('rejects keys that are not 32 bytes', () => {
    expect(() => encryptSecret('x', randomBytes(16).toString('base64'))).toThrow(SecretBoxError);
    expect(() => encryptSecret('x', '')).toThrow(SecretBoxError);
  });

  it('refuses plaintext values', () => {
    expect(isEncryptedSecret('APP_USR-plain')).toBe(false);
    expect(() => decryptSecret('APP_USR-plain', key)).toThrow(SecretBoxError);
  });
});
