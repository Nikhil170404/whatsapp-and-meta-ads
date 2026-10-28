import https from "node:https";
import dns from "node:dns";
import net from "node:net";
import { isPrivateIPv4, validWebhookUrl } from "./url";

export { validWebhookUrl };

/** True for addresses a customer-supplied URL must never be allowed to reach (our own network, cloud metadata, loopback). */
export function isPrivateAddress(ip: string): boolean {
  const v = ip.toLowerCase();
  if (net.isIPv6(v)) {
    if (v === "::1" || v === "::") return true;
    if (/^f[cd]/.test(v) || /^fe[89ab]/.test(v)) return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIPv4(mapped[1]);
    // IPv4 written in hex inside IPv6 (::ffff:7f00:1), and the translation ranges that wrap an IPv4 address.
    const hex = v.match(/^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) { const hi = parseInt(hex[1], 16), lo = parseInt(hex[2], 16); return isPrivateIPv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`); }
    return v.startsWith("2002:") || v.startsWith("64:ff9b:");
  }
  return isPrivateIPv4(v);
}

/** Checked at connection time, so a name that later points at a private address is still refused. */
const safeLookup: typeof dns.lookup = ((hostname: string, options: any, callback: any) => {
  const opts = typeof options === "object" && options ? options : {};
  dns.lookup(hostname, opts, (err: any, address: any, family: any) => {
    if (err) return callback(err);
    // Node may ask for every address (all: true) or just one; check each either way.
    const list: string[] = Array.isArray(address) ? address.map((a: any) => a.address) : [address];
    if (list.some(isPrivateAddress)) return callback(new Error("Blocked: the address is on a private network."));
    callback(null, address, family);
  });
}) as any;

/** Sends the collected details to the business's own URL. Returns whether the other side accepted it. */
export function postWebhook(rawUrl: string, body: unknown): Promise<boolean> {
  const url = validWebhookUrl(rawUrl);
  if (!url) return Promise.resolve(false);
  const payload = JSON.stringify(body);
  return new Promise((resolve) => {
    const req = https.request(url, {
      method: "POST", lookup: safeLookup as any, timeout: 5000,
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload), "User-Agent": "ReplyKaro-Webhook/1.0" },
    }, (res) => { res.resume(); resolve((res.statusCode ?? 500) >= 200 && (res.statusCode ?? 500) < 300); });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", () => resolve(false));
    req.end(payload);
  });
}
