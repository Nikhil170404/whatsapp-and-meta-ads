/**
 * Checks a WhatsApp Business account from the command line and can send one test message.
 *
 *   npm run wa:check                                    read-only checks
 *   npm run wa:check -- --send --to 919876543210        also send a test message
 *   npm run wa:check -- --send --to 919876543210 --template order_update --lang en_US
 *
 * Reads WHATSAPP_ACCESS_TOKEN and WHATSAPP_BUSINESS_ACCOUNT_ID (and optionally
 * WHATSAPP_PHONE_NUMBER_ID) from the environment. Run it in the Railway console, or locally with
 *   npx tsx --env-file=.env.local scripts/wa-check.ts
 * The token is never printed. Nothing is sent unless you pass --send.
 */
import { classifyMetaError } from "../lib/whatsapp/errors";
import { parseMessagingLimit, parseQuality } from "../lib/whatsapp/limits";
import { normalizePhone } from "../lib/whatsapp/phone";

const GRAPH = "https://graph.facebook.com/v25.0";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1]?.startsWith("--") ? "true" : process.argv[i + 1] ?? "true";
};
const has = (name: string) => process.argv.includes(`--${name}`);

const token = process.env.WHATSAPP_ACCESS_TOKEN;
const waba = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
let phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

const ok = (m: string) => console.log(`  ✓ ${m}`);
const bad = (m: string) => console.log(`  ✗ ${m}`);
const info = (m: string) => console.log(`    ${m}`);
let failures = 0;

async function graph(path: string, init?: RequestInit) {
  const res = await fetch(`${GRAPH}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data?.error ?? {};
    const err: any = new Error(e.error_user_msg || e.message || `HTTP ${res.status}`);
    err.code = e.code;
    throw err;
  }
  return data;
}

function explain(err: any): string {
  const v = classifyMetaError(err.code, err.message);
  if (err.code === 190) return "The access token is invalid or expired. Temporary tokens from the API Setup page last about 24 hours; create a permanent System User token instead.";
  if (err.code === 100 || err.code === 33) return `Meta cannot find that ID or the token cannot see it (${err.message}). Check the WABA ID and that the token's app/user has access to this account.`;
  if (err.code === 10 || err.code === 200) return `The token lacks a permission (${err.message}). It needs whatsapp_business_management and whatsapp_business_messaging.`;
  return v.action === "abort" || v.action === "skip" || v.action === "fail" ? (v as any).reason : err.message;
}

async function main() {
  console.log("\nWhatsApp account check\n");

  if (!token) { bad("WHATSAPP_ACCESS_TOKEN is not set."); process.exit(1); }
  if (!waba) { bad("WHATSAPP_BUSINESS_ACCOUNT_ID is not set."); process.exit(1); }
  ok(`Token present (${token.length} characters, not shown)`);

  console.log("\n1. Business account");
  try {
    const a = await graph(`${waba}?fields=id,name,currency,timezone_id,account_review_status,business_verification_status`);
    ok(`${a.name ?? "(no name)"} (${a.id})`);
    if (a.business_verification_status) info(`Business verification: ${a.business_verification_status}`);
    if (a.account_review_status) info(`Account review: ${a.account_review_status}`);
    if (a.currency) info(`Billing currency: ${a.currency}${a.currency !== "INR" ? "  (India accounts must be billed in INR by 31 Dec 2026)" : ""}`);
  } catch (e: any) { failures++; bad(explain(e)); console.log("\nStopping: fix the account or token first.\n"); process.exit(1); }

  console.log("\n2. Phone numbers");
  try {
    const p = await graph(`${waba}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,messaging_limit_tier,status,platform_type,throughput`);
    const numbers: any[] = p.data ?? [];
    if (!numbers.length) { failures++; bad("No phone numbers on this account."); }
    for (const n of numbers) {
      const q = parseQuality(n.quality_rating);
      const lim = parseMessagingLimit(n.messaging_limit_tier);
      ok(`${n.display_phone_number}  "${n.verified_name ?? "?"}"  id=${n.id}`);
      info(`Quality: ${q.label} (${n.quality_rating ?? "NA"})   Limit: ${lim.label} customers/24h   Status: ${n.status ?? "?"}`);
      if (n.throughput?.level) info(`Throughput: ${n.throughput.level}`);
    }
    if (!phoneNumberId && numbers[0]) {
      phoneNumberId = numbers[0].id;
      info(`WHATSAPP_PHONE_NUMBER_ID not set; using the first number (${phoneNumberId}).`);
    } else if (phoneNumberId && !numbers.some((n) => n.id === phoneNumberId)) {
      failures++; bad(`WHATSAPP_PHONE_NUMBER_ID=${phoneNumberId} is not on this account.`);
    }
  } catch (e: any) { failures++; bad(explain(e)); }

  console.log("\n3. Message templates");
  try {
    const t = await graph(`${waba}/message_templates?fields=name,status,category,language&limit=200`);
    const list: any[] = t.data ?? [];
    const by = (s: string) => list.filter((x) => x.status === s).length;
    ok(`${list.length} templates: ${by("APPROVED")} approved, ${by("PENDING")} pending, ${by("REJECTED")} rejected`);
    const approved = list.filter((x) => x.status === "APPROVED").slice(0, 8).map((x) => `${x.name} (${x.language}, ${x.category})`);
    if (approved.length) info(`Approved: ${approved.join("; ")}`);
    if (!list.length) info("None yet. A new test account usually has the sample template hello_world.");
  } catch (e: any) { failures++; bad(explain(e)); }

  console.log("\n4. Webhook subscription");
  try {
    const s = await graph(`${waba}/subscribed_apps`);
    const apps: any[] = s.data ?? [];
    if (apps.length) ok(`Subscribed apps: ${apps.map((a) => a.whatsapp_business_api_data?.name ?? a.name ?? a.id).join(", ")}`);
    else { failures++; bad("No app is subscribed to this account's webhooks. Incoming messages will not reach you. Run: npm run wa:link (it subscribes the app)."); }
  } catch (e: any) { failures++; bad(explain(e)); }

  if (!has("send")) {
    console.log("\nNo message sent (add --send --to <number> to send a test).\n");
    process.exit(failures ? 1 : 0);
  }

  console.log("\n5. Send a test message");
  let to = normalizePhone(arg("to"));
  if (!to) { bad("Give the recipient with --to, including the country code, for example --to 919876543210"); process.exit(1); }
  // A bare 10-digit Indian mobile number (starts 6-9) has no country code, so WhatsApp could not find it.
  if (/^[6-9]\d{9}$/.test(to)) {
    info(`${to} has no country code; assuming India and using 91${to}. Pass the full number to avoid this.`);
    to = `91${to}`;
  }
  if (!phoneNumberId) { bad("No phone number to send from."); process.exit(1); }

  const template = arg("template") ?? "hello_world";
  const lang = arg("lang") ?? "en_US";
  const params = (arg("params") ?? "").split("|").filter(Boolean);
  const body = {
    messaging_product: "whatsapp", to, type: "template",
    template: { name: template, language: { code: lang },
      ...(params.length ? { components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }] } : {}) },
  };
  info(`Sending template "${template}" (${lang}) from ${phoneNumberId} to +${to}`);
  try {
    const r = await graph(`${phoneNumberId}/messages`, { method: "POST", body: JSON.stringify(body) });
    ok(`Accepted by WhatsApp. Message id: ${r.messages?.[0]?.id}`);
    info("Accepted is not delivered. Delivery and read receipts arrive through the webhook.");
    info("A test account can only message numbers added under API Setup → To, and each must be verified.");
  } catch (e: any) { failures++; bad(explain(e)); }
  console.log("");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error("Unexpected error:", e?.message ?? e); process.exit(1); });
