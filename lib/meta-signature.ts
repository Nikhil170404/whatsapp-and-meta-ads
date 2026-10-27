import crypto from "crypto";

/**
 * Verify Meta's `x-hub-signature-256` header against the raw request body.
 *
 * Meta signs every webhook payload with the app secret. Verifying it ensures only genuine Meta
 * callbacks can trigger actions that cost money (auto-replies, template sends).
 *
 * In production a missing FACEBOOK_APP_SECRET REJECTS every webhook: skipping verification would
 * let anyone on the internet post fake messages and make the app send paid replies. Outside
 * production (local testing) verification is skipped when no secret is configured.
 */
export function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appSecret) {
    if (process.env.NODE_ENV === "production") {
      console.error("FACEBOOK_APP_SECRET is not set: rejecting webhook because its signature cannot be verified.");
      return false;
    }
    return true;
  }
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const expected = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(signatureHeader.slice("sha256=".length), "hex");

  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}
