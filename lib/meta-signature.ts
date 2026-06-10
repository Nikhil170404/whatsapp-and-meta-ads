import crypto from "crypto";
import { env } from "@/lib/env";

/**
 * Verify Meta's `x-hub-signature-256` header against the raw request body.
 *
 * Meta signs every webhook payload with the app secret. Verifying it ensures
 * only genuine Meta callbacks can trigger actions that cost money (auto-replies,
 * comment-to-DM). Verification is enforced only when FACEBOOK_APP_SECRET is set,
 * so deployments that haven't configured it continue to work unchanged.
 */
export function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = env.FACEBOOK_APP_SECRET;
  if (!appSecret) return true; // not configured — skip verification
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const expected = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(signatureHeader.slice("sha256=".length), "hex");

  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}
