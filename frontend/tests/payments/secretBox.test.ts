import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
  SecretBoxError,
} from "@/lib/payments/secretBox";

const key = randomBytes(32).toString("base64");

describe("secretBox key rotation", () => {
  it("round-trips legacy-compatible v1 secrets supplied with an explicit key", () => {
    const sealed = encryptSecret("APP_USR-123", key);
    expect(sealed.startsWith("enc:v1:")).toBe(true);
    expect(sealed).not.toContain("APP_USR-123");
    expect(decryptSecret(sealed, key)).toBe("APP_USR-123");
  });
  it("writes key-id versioned v2 and reads old v1 and previous v2 keys", () => {
    const legacy = encryptSecret("legacy secret", key);
    const oldKey = randomBytes(32).toString("base64");
    const previous = process.env.PAYMENTS_ENCRYPTION_KEY;
    const previousId = process.env.PAYMENTS_ENCRYPTION_KEY_ID;
    const previousKeys = process.env.PAYMENTS_ENCRYPTION_KEYS;
    process.env.PAYMENTS_ENCRYPTION_KEY = key;
    process.env.PAYMENTS_ENCRYPTION_KEY_ID = "current";
    process.env.PAYMENTS_ENCRYPTION_KEYS = JSON.stringify({
      legacy: key,
      previous: oldKey,
    });
    try {
      const current = encryptSecret("current secret");
      expect(current.startsWith("enc:v2:current:")).toBe(true);
      expect(decryptSecret(current)).toBe("current secret");
      const oldV2 = [
        "enc",
        "v2",
        "previous",
        ...encryptSecret("old key", oldKey).split(":").slice(2),
      ].join(":");
      expect(decryptSecret(oldV2)).toBe("old key");
      expect(decryptSecret(legacy)).toBe("legacy secret");
    } finally {
      if (previous === undefined) delete process.env.PAYMENTS_ENCRYPTION_KEY;
      else process.env.PAYMENTS_ENCRYPTION_KEY = previous;
      if (previousId === undefined)
        delete process.env.PAYMENTS_ENCRYPTION_KEY_ID;
      else process.env.PAYMENTS_ENCRYPTION_KEY_ID = previousId;
      if (previousKeys === undefined)
        delete process.env.PAYMENTS_ENCRYPTION_KEYS;
      else process.env.PAYMENTS_ENCRYPTION_KEYS = previousKeys;
    }
  });
  it("uses a fresh IV per call and rejects tampering and wrong keys", () => {
    expect(encryptSecret("same", key)).not.toBe(encryptSecret("same", key));
    const sealed = encryptSecret("secret", key);
    const parts = sealed.split(":");
    const ciphertext = Buffer.from(parts[4], "base64");
    ciphertext[0] ^= 0xff;
    parts[4] = ciphertext.toString("base64");
    expect(() => decryptSecret(parts.join(":"), key)).toThrow(SecretBoxError);
    expect(() =>
      decryptSecret(sealed, randomBytes(32).toString("base64")),
    ).toThrow(SecretBoxError);
  });
  it("rejects invalid keys and plaintext values", () => {
    expect(() =>
      encryptSecret("x", randomBytes(16).toString("base64")),
    ).toThrow(SecretBoxError);
    expect(isEncryptedSecret("APP_USR-plain")).toBe(false);
    expect(() => decryptSecret("APP_USR-plain", key)).toThrow(SecretBoxError);
  });
});
