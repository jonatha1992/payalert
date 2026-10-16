import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc";
const IV_BYTES = 12;
type KeySet = {
  active: { id: string; key: string };
  keys: Map<string, string>;
};

export class SecretBoxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretBoxError";
  }
}

function parseKey(raw: string, label: string): Buffer {
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32)
    throw new SecretBoxError(`${label} must be 32 bytes encoded as base64`);
  return key;
}

function loadKeys(keyOverride?: string): KeySet {
  if (keyOverride)
    return {
      active: { id: "legacy", key: keyOverride },
      keys: new Map([["legacy", keyOverride]]),
    };
  const active = process.env.PAYMENTS_ENCRYPTION_KEY;
  if (!active)
    throw new SecretBoxError("PAYMENTS_ENCRYPTION_KEY is not configured");
  const activeId = process.env.PAYMENTS_ENCRYPTION_KEY_ID ?? "default";
  const keys = new Map<string, string>();
  const configured = process.env.PAYMENTS_ENCRYPTION_KEYS;
  if (configured) {
    try {
      const parsed: unknown = JSON.parse(configured);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error("invalid key map");
      for (const [id, value] of Object.entries(parsed)) {
        if (!id || typeof value !== "string")
          throw new Error("invalid key entry");
        parseKey(value, `PAYMENTS_ENCRYPTION_KEYS[${id}]`);
        keys.set(id, value);
      }
    } catch (error) {
      if (error instanceof SecretBoxError) throw error;
      throw new SecretBoxError(
        "PAYMENTS_ENCRYPTION_KEYS must be a JSON object of base64 keys",
      );
    }
  }
  parseKey(active, "PAYMENTS_ENCRYPTION_KEY");
  keys.set(activeId, active);
  return { active: { id: activeId, key: active }, keys };
}

function seal(
  plaintext: string,
  keyB64: string,
  version: "v1" | "v2",
  id?: string,
): string {
  const key = parseKey(keyB64, "Encryption key");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const prefix = version === "v1" ? [PREFIX, version] : [PREFIX, version, id];
  return [
    ...prefix,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function isEncryptedSecret(value: string | null | undefined): boolean {
  return typeof value === "string" && /^enc:v[12]:/.test(value);
}

export function encryptSecret(plaintext: string, keyB64?: string): string {
  if (keyB64) return seal(plaintext, keyB64, "v1");
  const { active } = loadKeys();
  return seal(plaintext, active.key, "v2", active.id);
}

export function decryptSecret(sealed: string, keyB64?: string): string {
  if (typeof sealed !== "string" || !isEncryptedSecret(sealed))
    throw new SecretBoxError("Value is not an encrypted secret");
  const parts = sealed.split(":");
  const version = parts[1];
  const id = version === "v2" ? parts[2] : "legacy";
  const offset = version === "v2" ? 3 : 2;
  const [ivB64, tagB64, ctB64] = parts.slice(offset);
  if (parts.length !== offset + 3 || !ivB64 || !tagB64 || ctB64 === undefined)
    throw new SecretBoxError("Malformed encrypted secret");
  const keys = keyB64
    ? new Map([
        [id, keyB64],
        ["legacy", keyB64],
      ])
    : loadKeys().keys;
  const selected = keys.get(id);
  if (!selected)
    throw new SecretBoxError(`No decryption key configured for key id ${id}`);
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      parseKey(selected, "Decryption key"),
      Buffer.from(ivB64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(ctB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new SecretBoxError("Encrypted secret could not be decrypted");
  }
}
