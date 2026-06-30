import crypto from "crypto";

const SECRET = process.env.CROSS_SELL_SECRET || "";
const OWN_PREFIX = "WA";
const PARTNER_PREFIX = "IG";

function sign(prefix: string, payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(`${prefix}.${payload}`).digest("base64url").slice(0, 16);
}

export function generateBundleCode(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, iat: Date.now() })).toString("base64url");
  const sig = sign(OWN_PREFIX, payload);
  // "." is used as the delimiter (not "-") because base64url's own alphabet
  // includes "-", so payload/sig segments routinely contain it and would
  // break a naive split("-") into more than 3 parts.
  return `${OWN_PREFIX}.${payload}.${sig}`;
}

export function verifyPartnerBundleCode(code: string): { uid: string } | null {
  if (!SECRET) return null;
  const parts = code.trim().split(".");
  if (parts.length !== 3) return null;
  const [prefix, payload, sig] = parts;
  if (prefix !== PARTNER_PREFIX) return null;
  const expectedSig = sign(prefix, payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof decoded.uid !== "string") return null;
    if (Date.now() - decoded.iat > 365 * 24 * 3600 * 1000) return null;
    return { uid: decoded.uid };
  } catch {
    return null;
  }
}
