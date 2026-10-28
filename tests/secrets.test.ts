// @vitest-environment node
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { randomBytes } from "node:crypto";

const key = () => randomBytes(32).toString("base64");
const TOKEN = "EAAGm0PX4ZCpsBO" + "x".repeat(150);

beforeEach(() => { vi.resetModules(); vi.spyOn(console, "warn").mockImplementation(() => {}); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

async function load(env: Record<string, string> = {}) {
  vi.stubEnv("TOKEN_ENCRYPTION_KEY", ""); vi.stubEnv("TOKEN_ENCRYPTION_KEY_PREVIOUS", "");
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import("../lib/crypto/secrets");
}

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a token and the stored form hides it", async () => {
    const s = await load({ TOKEN_ENCRYPTION_KEY: key() });
    const stored = s.encryptSecret(TOKEN);
    expect(stored.startsWith("enc:v1:")).toBe(true);
    expect(stored).not.toContain("EAAG");
    expect(stored).not.toContain(TOKEN.slice(10, 40));
    expect(s.decryptSecret(stored)).toBe(TOKEN);
  });

  it("encrypts the same token differently each time (random IV)", async () => {
    const s = await load({ TOKEN_ENCRYPTION_KEY: key() });
    expect(s.encryptSecret(TOKEN)).not.toBe(s.encryptSecret(TOKEN));
  });

  it("does not double-encrypt, and leaves empty values alone", async () => {
    const s = await load({ TOKEN_ENCRYPTION_KEY: key() });
    const once = s.encryptSecret(TOKEN);
    expect(s.encryptSecret(once)).toBe(once);
    expect(s.encryptSecret("")).toBe("");
    expect(s.decryptSecret("")).toBe("");
    expect(s.decryptSecret(null)).toBe("");
  });

  it("still reads legacy plain-text tokens", async () => {
    const s = await load({ TOKEN_ENCRYPTION_KEY: key() });
    expect(s.decryptSecret(TOKEN)).toBe(TOKEN);
  });

  it("stores plain text with a warning when no key is set, instead of breaking logins", async () => {
    const s = await load();
    expect(s.encryptSecret(TOKEN)).toBe(TOKEN);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(s.isEncryptionConfigured()).toBe(false);
  });

  it("rejects a key that is not 32 bytes", async () => {
    const s = await load({ TOKEN_ENCRYPTION_KEY: "too-short" });
    expect(s.isEncryptionConfigured()).toBe(false);
  });

  it("accepts a 64-character hex key", async () => {
    const s = await load({ TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("hex") });
    expect(s.decryptSecret(s.encryptSecret(TOKEN))).toBe(TOKEN);
  });

  it("fails loudly (not silently) with the wrong key, and detects tampering", async () => {
    const a = key();
    const s1 = await load({ TOKEN_ENCRYPTION_KEY: a });
    const stored = s1.encryptSecret(TOKEN);
    const s2 = await load({ TOKEN_ENCRYPTION_KEY: key() });
    expect(() => s2.decryptSecret(stored)).toThrow(/TOKEN_ENCRYPTION_KEY has changed/);
    const s3 = await load({ TOKEN_ENCRYPTION_KEY: a });
    const flipped = stored.slice(0, -2) + (stored.endsWith("AA") ? "BB" : "AA");
    expect(() => s3.decryptSecret(flipped)).toThrow();
    const s4 = await load();
    expect(() => s4.decryptSecret(stored)).toThrow(/not set/);
  });

  it("supports key rotation through TOKEN_ENCRYPTION_KEY_PREVIOUS", async () => {
    const oldKey = key(), newKey = key();
    const stored = (await load({ TOKEN_ENCRYPTION_KEY: oldKey })).encryptSecret(TOKEN);
    const s = await load({ TOKEN_ENCRYPTION_KEY: newKey, TOKEN_ENCRYPTION_KEY_PREVIOUS: oldKey });
    expect(s.decryptSecret(stored)).toBe(TOKEN);
    expect(s.needsEncryption(stored)).toBe(true); // still on the old key: should be re-encrypted
    const rotated = s.encryptSecret(s.decryptSecret(stored));
    expect(s.needsEncryption(rotated)).toBe(false);
  });
});

describe("needsEncryption", () => {
  it("flags plain text only when there is a value", async () => {
    const s = await load({ TOKEN_ENCRYPTION_KEY: key() });
    expect(s.needsEncryption(TOKEN)).toBe(true);
    expect(s.needsEncryption("")).toBe(false);
    expect(s.needsEncryption(s.encryptSecret(TOKEN))).toBe(false);
  });
});

describe("toPublicConnection", () => {
  it("removes the access token before a row goes to the browser", async () => {
    const s = await load();
    const row = { status: "active", phone_number: "+1", access_token: TOKEN, waba_id: "1" };
    const pub = s.toPublicConnection(row)!;
    expect(pub).toEqual({ status: "active", phone_number: "+1", waba_id: "1" });
    expect(JSON.stringify(pub)).not.toContain("EAAG");
    expect(s.toPublicConnection(null)).toBeNull();
  });
});
