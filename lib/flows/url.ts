/** Pure URL checks shared by the editor (in the browser) and the server. No Node-only imports here. */

export function isPrivateIPv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || a >= 224;
}

/** A public https address, or null. Bare IPv6 addresses, credentials in the URL and local names are refused. */
export function validWebhookUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" || u.username || u.password) return null;
    if (u.hostname.startsWith("[")) return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) && isPrivateIPv4(u.hostname)) return null;
    if (!u.hostname.includes(".") || /^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(u.hostname)) return null;
    return u;
  } catch { return null; }
}
