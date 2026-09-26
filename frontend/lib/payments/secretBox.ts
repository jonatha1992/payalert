import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM envelope for provider credentials stored at rest.
 *
 * Format: `enc:v1:<iv b64>:<auth tag b64>:<ciphertext b64>`.
 * The key is 32 random bytes, base64-encoded, read from PAYMENTS_ENCRYPTION_KEY.
 */

const PREFIX = 'enc';
const VERSION = 'v1';
const IV_BYTES = 12;

export class SecretBoxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretBoxError';
  }
}

function loadKey(keyB64?: string): Buffer {
  const raw = keyB64 ?? process.env.PAYMENTS_ENCRYPTION_KEY ?? '';
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new SecretBoxError('PAYMENTS_ENCRYPTION_KEY must be 32 bytes encoded as base64');
  }
  return key;
}

export function isEncryptedSecret(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(`${PREFIX}:${VERSION}:`);
}

export function encryptSecret(plaintext: string, keyB64?: string): string {
  const key = loadKey(keyB64);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, VERSION, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
}

export function decryptSecret(sealed: string, keyB64?: string): string {
  if (!isEncryptedSecret(sealed)) {
    throw new SecretBoxError('Value is not an encrypted secret');
  }
  const key = loadKey(keyB64);
  const [, , ivB64, tagB64, ctB64] = sealed.split(':');
  if (!ivB64 || !tagB64 || ctB64 === undefined) {
    throw new SecretBoxError('Malformed encrypted secret');
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    throw new SecretBoxError('Encrypted secret could not be decrypted');
  }
}
