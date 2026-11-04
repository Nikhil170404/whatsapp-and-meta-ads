import { decryptSecret } from "@/lib/crypto/secrets";
import { verifySignature } from "@/lib/bridge/signing";

export type BridgeAuth = { ok: true; userId: string; linkId: string; body: any } | { ok: false; status: number; error: string };

/** Checks a signed request from .com: the Link ID, an active link, a fresh timestamp and the signature. */
export async function authenticateBridge(db: any, req: Request, nowMs = Date.now()): Promise<BridgeAuth> {
  const rawBody = await req.text();
  if (rawBody.length > 64 * 1024) return { ok: false, status: 413, error: "Body too large" };
  const linkId = req.headers.get("x-rk-link");
  if (!linkId) return { ok: false, status: 401, error: "Missing link" };
  const { data: link } = await db.from("bridge_links").select("user_id, signing_secret, status").eq("link_id", linkId).maybeSingle();
  if (!link || link.status === "revoked") return { ok: false, status: 401, error: "Unknown or revoked link" };
  let secret = "";
  try { secret = decryptSecret(link.signing_secret); } catch { return { ok: false, status: 500, error: "Link secret cannot be read" }; }
  const valid = verifySignature({ secret, timestamp: req.headers.get("x-rk-timestamp"), signature: req.headers.get("x-rk-signature"), rawBody, nowMs });
  if (!valid) return { ok: false, status: 401, error: "Bad signature" };
  let body: any;
  try { body = JSON.parse(rawBody); } catch { return { ok: false, status: 400, error: "Invalid JSON" }; }
  if (!body || typeof body !== "object") return { ok: false, status: 400, error: "Invalid body" };
  return { ok: true, userId: link.user_id, linkId, body };
}
