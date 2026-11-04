/**
 * Signing for the link with ReplyKaro Unified (replykaro.com).
 * Signature = hex HMAC-SHA256 of `${timestamp}.${rawBody}` with the link's secret, sent as x-rk-signature.
 * Both directions use the same headers: x-rk-link, x-rk-timestamp, x-rk-signature.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const TOLERANCE_SECONDS = 300;

export function signBody(secret: string, timestamp: number | string, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function signedHeaders(linkId: string, secret: string, rawBody: string, nowMs = Date.now()): Record<string, string> {
  const ts = Math.floor(nowMs / 1000);
  return {
    "content-type": "application/json",
    "x-rk-link": linkId,
    "x-rk-timestamp": String(ts),
    "x-rk-signature": signBody(secret, ts, rawBody),
  };
}

export function verifySignature(opts: { secret: string; timestamp: string | null; signature: string | null; rawBody: string; nowMs?: number }): boolean {
  const { secret, timestamp, signature, rawBody } = opts;
  if (!secret || !timestamp || !signature || !/^\d{9,13}$/.test(timestamp)) return false;
  const ts = Number(timestamp);
  const seconds = ts > 1e11 ? Math.floor(ts / 1000) : ts; // seconds or milliseconds
  if (Math.abs(Math.floor((opts.nowMs ?? Date.now()) / 1000) - seconds) > TOLERANCE_SECONDS) return false;
  if (!/^[0-9a-fA-F]+$/.test(signature)) return false;
  const expected = Buffer.from(signBody(secret, timestamp, rawBody), "hex");
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Only https addresses (plain http only for localhost, for testing). */
export function isSafeComUrl(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.username || u.password) return false;
    return u.protocol === "https:" || (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1"));
  } catch {
    return false;
  }
}
