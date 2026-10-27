/**
 * Content Security Policy for the signed-in app (dashboard, sign-in, admin).
 *
 * Scripts need a per-request nonce, so an injected <script> (cross-site scripting) cannot run
 * even if it reaches the page, and `eval` is blocked. `'strict-dynamic'` lets the scripts we
 * start load the ones they depend on (Razorpay checkout, Google Analytics) without listing every
 * host. Styles keep 'unsafe-inline' because React, Radix and Tailwind set inline styles.
 *
 * Public marketing pages keep the broader policy in next.config.ts: they are pre-rendered, and a
 * nonce would force every visit to be rendered on demand.
 *
 * CSP_MODE=report-only shows violations in the browser console without blocking (use it to find
 * a missed third-party script); CSP_MODE=off removes this policy. Default: enforce.
 */
export type CspMode = "enforce" | "report-only" | "off";

export function cspMode(raw = process.env.CSP_MODE): CspMode {
  return raw === "report-only" || raw === "off" ? raw : "enforce";
}

/** Paths that get the strict policy. */
export const STRICT_CSP_PREFIXES = ["/wa", "/signin", "/admin"];
export const needsStrictCsp = (pathname: string) =>
  STRICT_CSP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export function buildStrictCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://checkout.razorpay.com https://www.googletagmanager.com https://connect.facebook.net`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "media-src 'self' https://*.supabase.co",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://api.razorpay.com https://ipapi.co https://ipwho.is https://lumberjack.razorpay.com https://www.googletagmanager.com https://www.google-analytics.com https://graph.facebook.com https://www.facebook.com",
    "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://www.facebook.com https://web.facebook.com",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
  ].join("; ");
}

export const cspHeaderName = (mode: CspMode) =>
  mode === "report-only" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";

/** A fresh, unguessable nonce for one request. Works in the edge runtime. */
export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
