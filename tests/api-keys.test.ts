import { describe, it, expect } from "vitest";
import { generateApiKey, hashApiKey, isHashedKey, looksLikeApiKey } from "../lib/api/keys";

describe("API keys", () => {
  it("generates a key whose stored form is a hash, never the key", () => {
    const { key, stored, display } = generateApiKey();
    expect(looksLikeApiKey(key)).toBe(true);
    expect(stored).not.toContain(key);
    expect(isHashedKey(stored)).toBe(true);
    expect(stored).toBe(hashApiKey(key));
    expect(display).toMatch(/^rk_live_[a-f0-9]{4}…[a-f0-9]{4}$/);
  });
  it("generates distinct keys", () => {
    expect(generateApiKey().key).not.toBe(generateApiKey().key);
  });
  it("accepts legacy plain keys but rejects junk", () => {
    expect(looksLikeApiKey("rk_live_" + "a".repeat(32))).toBe(true);
    expect(looksLikeApiKey("rk_live_short")).toBe(false);
    expect(looksLikeApiKey("sk_live_" + "a".repeat(32))).toBe(false);
    expect(looksLikeApiKey("rk_live_" + "a".repeat(32) + "') or ('1'='1")).toBe(false);
    expect(looksLikeApiKey(undefined)).toBe(false);
  });
});
