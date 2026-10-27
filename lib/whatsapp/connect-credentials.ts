/**
 * Connects a WhatsApp Business account to a ReplyKaro account from a WABA ID and an access
 * token, without Facebook login. This is how Meta's free test account and System User tokens
 * are used. It is checked against Meta before anything is saved, and the token is never
 * returned or logged.
 */
import { encryptSecret } from "@/lib/crypto/secrets";
import { parseMessagingLimit, parseQuality } from "@/lib/whatsapp/limits";
import type { OpResult } from "@/lib/api/ops";

const GRAPH = "https://graph.facebook.com/v25.0";

export interface CredentialsInput {
  wabaId: string;
  token: string;
  /** Pick a specific number; otherwise the first one on the account is used. */
  phoneNumberId?: string;
}

export interface ConnectSummary {
  phone_number: string;
  business_name: string | null;
  phone_number_id: string;
  quality: string;
  messaging_limit: string;
  looks_like_test_number: boolean;
  token_expires_at: string | null;
  token_expires_warning: string | null;
  webhook_subscribed: boolean;
  templates: { approved: number; total: number };
}

const fail = (status: number, error: string, code?: string): OpResult<never> => ({ ok: false, status, error, code });

export function validateCredentials(input: Partial<CredentialsInput>): string | null {
  const waba = String(input.wabaId ?? "").trim();
  const token = String(input.token ?? "").trim();
  const phone = String(input.phoneNumberId ?? "").trim();
  if (!/^\d{5,25}$/.test(waba)) return "The WhatsApp Business Account ID is a number, for example 2115477789298460. Copy it from Meta → WhatsApp → API Setup.";
  if (token.length < 30 || /\s/.test(token)) return "Paste the whole access token without spaces. It is a long string starting with EA.";
  if (phone && !/^\d{5,25}$/.test(phone)) return "The Phone number ID is a number. Leave it empty to use the first number on the account.";
  return null;
}

/** Plain-language reason for a Meta error code. */
export function explainGraphError(code: number | undefined, message: string): string {
  if (code === 190) return "Meta says this access token is invalid or has expired. Temporary tokens from the API Setup page last about 24 hours: generate a new one, or create a permanent System User token.";
  if (code === 100 || code === 33) return `Meta could not find that account, or this token cannot see it (${message}). Check the WhatsApp Business Account ID, and that the token belongs to an app with access to it.`;
  if (code === 10 || code === 200 || code === 3) return `This token is missing a permission (${message}). It needs whatsapp_business_management and whatsapp_business_messaging.`;
  if (code === 4 || code === 17 || code === 80007) return "Meta is rate limiting requests right now. Wait a minute and try again.";
  return message;
}

async function graph(path: string, token: string, init: RequestInit | undefined, f: typeof fetch) {
  const res = await f(`${GRAPH}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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

export async function connectWithCredentials(
  db: any,
  userId: string,
  input: CredentialsInput,
  opts: { fetchImpl?: typeof fetch; appId?: string; appSecret?: string } = {}
): Promise<OpResult<ConnectSummary>> {
  const f = opts.fetchImpl ?? fetch;
  const problem = validateCredentials(input);
  if (problem) return fail(400, problem, "INVALID_INPUT");
  const waba = input.wabaId.trim();
  const token = input.token.trim();

  // 1. Ask Meta for the account's numbers. This proves the token, the ID and the permission.
  let phones: any[];
  try {
    const r = await graph(`${waba}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,messaging_limit_tier`, token, undefined, f);
    phones = r.data ?? [];
  } catch (e: any) {
    return fail(400, explainGraphError(e.code, e.message), "META_REJECTED");
  }
  const wanted = input.phoneNumberId?.trim();
  const phone = wanted ? phones.find((p) => p.id === wanted) : phones[0];
  if (!phone) {
    return fail(400, wanted ? "That phone number is not on this WhatsApp account." : "This WhatsApp account has no phone numbers yet. Add one in Meta first.", "NO_PHONE");
  }

  // 2. Token expiry, when we can read it (needs the app id and secret). 0 means it never expires.
  let expiresAt: string | null = null;
  let warning: string | null = null;
  if (opts.appId && opts.appSecret) {
    try {
      const r = await f(`${GRAPH}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${opts.appId}|${opts.appSecret}`, { signal: AbortSignal.timeout(15_000) });
      const d: any = (await r.json())?.data;
      if (d?.is_valid === false) return fail(400, "Meta says this token is not valid. Create a new one.", "TOKEN_INVALID");
      if (d?.expires_at) {
        expiresAt = new Date(d.expires_at * 1000).toISOString();
        warning = `This is a temporary token and expires ${new Date(expiresAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}. Replace it before then, or use a permanent System User token.`;
      }
    } catch { /* optional */ }
  }

  // 3. Save the connection for this account.
  const { error } = await db.from("wa_connections").upsert({
    user_id: userId, phone_number_id: phone.id, waba_id: waba, phone_number: phone.display_phone_number,
    display_name: phone.verified_name ?? null, access_token: encryptSecret(token), token_expires_at: expiresAt, status: "active",
    quality_rating: phone.quality_rating ?? "NA", messaging_limit_tier: phone.messaging_limit_tier ?? "TIER_NOT_SET",
    token_refresh_failed_at: null, last_error: null, last_error_at: null,
  }, { onConflict: "user_id" });
  if (error) {
    return fail(/duplicate|unique/i.test(error.message) ? 409 : 500,
      /duplicate|unique/i.test(error.message) ? "That phone number is already connected to a different ReplyKaro account." : "Could not save the connection. Please try again.",
      "SAVE_FAILED");
  }

  // 4. Subscribe our app to this account's webhooks, then report what Meta shows.
  let subscribed = false;
  try { await graph(`${waba}/subscribed_apps`, token, { method: "POST" }, f); subscribed = true; } catch { /* reported below */ }
  let templates = { approved: 0, total: 0 };
  try {
    const t = await graph(`${waba}/message_templates?fields=status&limit=200`, token, undefined, f);
    const list: any[] = t.data ?? [];
    templates = { approved: list.filter((x) => x.status === "APPROVED").length, total: list.length };
  } catch { /* optional */ }

  return {
    ok: true,
    data: {
      phone_number: phone.display_phone_number, business_name: phone.verified_name ?? null, phone_number_id: phone.id,
      quality: parseQuality(phone.quality_rating).label, messaging_limit: parseMessagingLimit(phone.messaging_limit_tier).label,
      looks_like_test_number: /^\+?1\s?555/.test(String(phone.display_phone_number)) || /test/i.test(String(phone.verified_name)),
      token_expires_at: expiresAt, token_expires_warning: warning, webhook_subscribed: subscribed, templates,
    },
  };
}

/** Accounts allowed to use the server's own WhatsApp credentials (ADMIN_EMAILS, comma separated). */
export function isAdminEmail(email: string | null | undefined, list = process.env.ADMIN_EMAILS): boolean {
  if (!email || !list) return false;
  return list.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean).includes(email.trim().toLowerCase());
}

export function serverCredentials(env = process.env): CredentialsInput | null {
  const wabaId = env.WHATSAPP_BUSINESS_ACCOUNT_ID, token = env.WHATSAPP_ACCESS_TOKEN;
  return wabaId && token ? { wabaId, token, phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || undefined } : null;
}
