/**
 * Encryption at rest for access tokens stored in the database (AES-256-GCM).
 *
 * A database leak (backup, SQL export, a mis-set policy) must not hand over working WhatsApp
 * or Facebook tokens. Tokens are encrypted with a key that lives only in the server environment
 * (TOKEN_ENCRYPTION_KEY, on both the website and the worker), never in the database.
 *
 * Stored form:  enc:v1:<base64url(iv ‖ auth tag ‖ ciphertext)>
 *
 * - A value without the "enc:v1:" prefix is a legacy plain-text token and is still readable, so
 *   turning this on never breaks existing connections. `npm run secrets:encrypt` converts them.
 * - Rotation: put the new key in TOKEN_ENCRYPTION_KEY and the old one in
 *   TOKEN_ENCRYPTION_KEY_PREVIOUS (comma separated for several); old values keep decrypting.
 * - Without a key, tokens are stored as before and a warning is logged, so a missing variable
 *   never takes logins down. The dashboard shows a warning until the key is set.
 *
 * Generate a key:  openssl rand -base64 32
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Accepts 32 bytes as base64 or as 64 hex characters. */
export function parseKey(raw: string | undefined | null): Buffer | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (/^[0-9a-fA-F]{64}$/.test(v)) return Buffer.from(v, "hex");
  try {
    const b = Buffer.from(v, "base64");
    return b.length === 32 ? b : null;
  } catch {
    return null;
  }
}

function currentKey(): Buffer | null {
  return parseKey(process.env.TOKEN_ENCRYPTION_KEY);
}

function previousKeys(): Buffer[] {
  return (process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS ?? "").split(",").map(parseKey).filter((k): k is Buffer => !!k);
}

export const isEncrypted = (value: unknown): value is string => typeof value === "string" && value.startsWith(PREFIX);

export function isEncryptionConfigured(): boolean {
  return currentKey() !== null;
}

let warned = false;

export function encryptSecret(plain: string): string {
  if (!plain || isEncrypted(plain)) return plain;
  const key = currentKey();
  if (!key) {
    if (!warned) {
      warned = true;
      console.warn("[secrets] TOKEN_ENCRYPTION_KEY is not set (or is not 32 bytes): tokens are being stored WITHOUT encryption. Generate one with `openssl rand -base64 32`.");
    }
    return plain;
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

function tryDecrypt(payload: Buffer, key: Buffer): string | null {
  try {
    const iv = payload.subarray(0, IV_BYTES);
    const tag = payload.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const body = payload.subarray(IV_BYTES + TAG_BYTES);
    const d = createDecipheriv("aes-256-gcm", key, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(body), d.final()]).toString("utf8");
  } catch {
    return null; // wrong key or tampered value
  }
}

/** The usable token for a stored value. Plain-text legacy values pass through unchanged. */
export function decryptSecret(stored: string | null | undefined): string {
  if (!stored) return "";
  if (!isEncrypted(stored)) return stored;
  const payload = Buffer.from(stored.slice(PREFIX.length), "base64url");
  const keys = [currentKey(), ...previousKeys()].filter((k): k is Buffer => !!k);
  for (const k of keys) {
    const plain = tryDecrypt(payload, k);
    if (plain !== null) return plain;
  }
  throw new Error(
    keys.length === 0
      ? "A stored token is encrypted but TOKEN_ENCRYPTION_KEY is not set. Set the same key the token was encrypted with."
      : "A stored token could not be decrypted: TOKEN_ENCRYPTION_KEY has changed. Put the old key in TOKEN_ENCRYPTION_KEY_PREVIOUS."
  );
}

/** True when a value should be (re)written: plain text, or encrypted with a key that is no longer current. */
export function needsEncryption(stored: string | null | undefined): boolean {
  if (!stored) return false;
  if (!isEncrypted(stored)) return true;
  const key = currentKey();
  if (!key) return false;
  return tryDecrypt(Buffer.from(stored.slice(PREFIX.length), "base64url"), key) === null;
}

/** A connection row safe to send to the browser: never includes the access token. */
export function toPublicConnection<T extends Record<string, any>>(row: T | null | undefined): Omit<T, "access_token"> | null {
  if (!row) return null;
  const { access_token: _omit, ...rest } = row;
  return rest;
}
