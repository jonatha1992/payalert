import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateNonce, sha256Hex, shouldUseGoogleIdentity, googleLoginError } from '@/lib/googleIdentity';

describe('Google Identity nonce', () => {
  beforeEach(() => vi.stubGlobal('crypto', globalThis.crypto));

  it('generates a 32-byte nonce and hashes it to the expected SHA-256 hex', async () => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      if (!array) throw new Error('Nonce random buffer is required');
      const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      bytes.fill(0);
      bytes[bytes.length - 1] = 1;
      return array;
    });
    const nonce = generateNonce();
    expect(nonce).toBe(`${'00'.repeat(31)}01`);
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(await sha256Hex(nonce)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('Google login decisions', () => {
  it.each([
    ['valid client id', 'client-id.apps.googleusercontent.com', true],
    ['missing client id', undefined, false],
    ['empty client id', '', false],
    ['whitespace client id', '  ', false],
  ])('selects GIS or fallback for %s', (_label, clientId, expected) => {
    expect(shouldUseGoogleIdentity(clientId)).toBe(expected);
  });

  it('maps Google login errors to the Spanish message', () => {
    expect(googleLoginError()).toBe('No pudimos ingresar con Google. Probá de nuevo.');
  });
});
