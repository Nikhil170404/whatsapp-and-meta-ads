import { createHash, randomBytes } from "node:crypto";

/**
 * API keys are shown to the user once and stored only as a SHA-256 hash, so a
 * database leak does not expose working keys. Keys created before hashing was
 * introduced are stored in plain text; they keep working until regenerated.
 */
export const KEY_PREFIX = "rk_live_";
const HASH_MARK = "h_";

export function hashApiKey(key: string): string {
  return HASH_MARK + createHash("sha256").update(key).digest("hex");
}

export function generateApiKey() {
  const key = KEY_PREFIX + randomBytes(24).toString("hex");
  return { key, stored: hashApiKey(key), display: `${key.slice(0, KEY_PREFIX.length + 4)}…${key.slice(-4)}` };
}

export function looksLikeApiKey(value: unknown): value is string {
  return typeof value === "string" && /^rk_live_[a-f0-9]{32,64}$/.test(value);
}

/** True when a stored value is a hash rather than a usable plain-text key. */
export const isHashedKey = (stored: string) => stored.startsWith(HASH_MARK);
