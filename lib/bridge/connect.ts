/** One-click connect from ReplyKaro Unified: which addresses we trust, and where to land after sign-in. */

export const AFTER_LOGIN_COOKIE = "rk_after_login";
export const DEFAULT_COM_ORIGINS = "https://www.replykaro.com,https://replykaro.com";

export function allowedComOrigins(env: Record<string, string | undefined> = process.env): string[] {
  return (env.UNIFIED_COM_ORIGINS || DEFAULT_COM_ORIGINS)
    .split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);
}

/** The origin of a return address if it is one we trust (https, or http on localhost when listed), otherwise null. */
export function trustedOrigin(url: unknown, env: Record<string, string | undefined> = process.env): string | null {
  if (typeof url !== "string" || url.length > 500) return null;
  try {
    const u = new URL(url);
    if (u.username || u.password) return null;
    return allowedComOrigins(env).includes(u.origin) ? u.origin : null;
  } catch {
    return null;
  }
}

export const isValidCode = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{32,64}$/.test(v);

export function connectPath(code: string, from: string): string {
  return `/wa/unified/connect?code=${encodeURIComponent(code)}&from=${encodeURIComponent(from)}`;
}

/** Only our own connect page may be used as a post-login landing page. */
export function isSafeAfterLogin(path: unknown): path is string {
  return typeof path === "string" && path.length < 1200 && path.startsWith("/wa/unified/connect?") && !path.includes("//") && !path.includes("\\");
}
