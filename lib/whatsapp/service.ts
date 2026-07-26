import { env } from "@/lib/env";
import { parseMessagingTier, tierOrdinal } from "@/lib/whatsapp/messaging-limits";

const WA_API_URL = "https://graph.facebook.com/v25.0";

// ─── Meta error codes that indicate the token has expired ────────────────────
export const TOKEN_EXPIRED_CODES = new Set([190, 131005]);

// ─── Meta error codes that mean the customer is unreachable ──────────────────
// These should not count against quality but should be logged.
export const UNREACHABLE_CODES = new Set([
  131026, // Message undeliverable (number doesn't exist / not on WA)
  131047, // Re-engagement outside 24-hour window — must use template
  131056, // User opted out of receiving messages from this business
  133016, // Customer phone number changed
  63049,  // US marketing ban — marketing templates to +1 numbers (since April 1, 2025)
]);

// ─── Rate-limit error codes ───────────────────────────────────────────────────
export const RATE_LIMIT_CODES = new Set([
  130429, // Rate limit hit — back off exponentially
  131056, // Duplicate: also opts-out but surfaces as rate-signal
]);

// ─── Codes that block ALL sending until the account owner acts ────────────────
// These are not transient: retrying changes nothing, so they need to be shown to
// the user as a task rather than logged as a failure.
export const ACCOUNT_BLOCKED_CODES = new Set([
  131042, // Business eligibility payment issue — no valid payment method on the WABA
  131031, // Account has been locked / restricted
  368,    // Temporarily blocked for policy violations
]);

/**
 * Plain-language explanation and next step for the codes users actually hit.
 * Meta's own message ("Business eligibility payment issue") does not say what to
 * do, so the raw text is not enough on its own.
 */
const ERROR_GUIDANCE: Record<number, string> = {
  131042:
    "WhatsApp has no valid payment method for this account, so Meta is blocking all outgoing messages. " +
    "Add a credit card in Meta Business Settings → Billing & Payments, assign it to this WhatsApp Business Account, " +
    "and make sure the business country, currency and tax info are filled in.",
  131031: "Meta has restricted this WhatsApp Business Account. Check Business Support Home for the reason and to appeal.",
  368: "Meta has temporarily blocked this account for a policy violation. Check Business Support Home.",
  131047:
    "The customer's last message is more than 24 hours old, so a free-form reply is not allowed. " +
    "Send an approved template instead.",
  131056: "This customer opted out of messages from your business.",
  131026: "That number is not reachable on WhatsApp.",
  190: "The access token expired. Reconnect WhatsApp to get a fresh one.",
  131005: "The access token expired. Reconnect WhatsApp to get a fresh one.",
  63049: "Meta blocks marketing templates to US numbers. Use a utility or service message instead.",
};

export interface MetaApiError {
  code: number;
  message: string;
  type?: string;
  fbtrace_id?: string;
  isTokenExpired: boolean;
  isRateLimit: boolean;
  isUnreachable: boolean;
  /** Sending is blocked account-wide until the owner fixes something. */
  isAccountBlocked: boolean;
  /** Plain-language explanation with the next step, when one is known. */
  guidance?: string;
}

export function parseMetaError(raw: any): MetaApiError {
  const e = raw?.error ?? raw;
  const code = e?.code ?? 0;
  return {
    code,
    message: e?.message ?? JSON.stringify(raw),
    type: e?.type,
    fbtrace_id: e?.fbtrace_id,
    isTokenExpired: TOKEN_EXPIRED_CODES.has(code),
    isRateLimit: RATE_LIMIT_CODES.has(code),
    isUnreachable: UNREACHABLE_CODES.has(code),
    isAccountBlocked: ACCOUNT_BLOCKED_CODES.has(code),
    guidance: ERROR_GUIDANCE[code],
  };
}

/** One line suitable for storing in last_error and showing in the UI. */
export function describeMetaError(err: MetaApiError): string {
  const guidance = ERROR_GUIDANCE[err.code];
  return guidance ? `${guidance} (Meta error ${err.code})` : `(#${err.code}) ${err.message}`;
}

/** Wait `ms` milliseconds — used to throttle broadcast sends. */
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Messaging ───────────────────────────────────────────────────────────────

export async function sendTextMessage(
  phoneNumberId: string,
  to: string,
  text: string,
  accessToken: string
) {
  const response = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  if (!response.ok) {
    const raw = await response.json();
    const err = parseMetaError(raw);
    const e = new Error(`WhatsApp API Error: ${JSON.stringify(raw)}`) as any;
    e.metaError = err;
    throw e;
  }

  return response.json();
}

export async function sendTemplateMessage(
  phoneNumberId: string,
  to: string,
  templateName: string,
  langCode: string = "en_US",
  accessToken: string,
  components?: Array<{ type: string; parameters: Array<{ type: string; text: string }> }>
) {
  const response = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: langCode },
        ...(components && components.length > 0 ? { components } : {}),
      },
    }),
  });

  if (!response.ok) {
    const raw = await response.json();
    const err = parseMetaError(raw);
    const e = new Error(`WhatsApp API Error: ${JSON.stringify(raw)}`) as any;
    e.metaError = err;
    throw e;
  }

  return response.json();
}

// ─── Interactive & media messaging ───────────────────────────────────────────

export interface QuickReplyButton {
  id: string;
  title: string; // max 20 chars per Meta
}

export async function sendButtonMessage(
  phoneNumberId: string,
  to: string,
  bodyText: string,
  buttons: QuickReplyButton[],
  accessToken: string
) {
  const response = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: buttons.map(b => ({ type: "reply", reply: { id: b.id, title: b.title } })),
        },
      },
    }),
  });
  if (!response.ok) {
    const raw = await response.json();
    const e = new Error(`WhatsApp API Error: ${JSON.stringify(raw)}`) as any;
    e.metaError = parseMetaError(raw);
    throw e;
  }
  return response.json();
}

export async function sendImageMessage(
  phoneNumberId: string,
  to: string,
  imageUrl: string,
  caption: string | undefined,
  accessToken: string
) {
  const response = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "image",
      image: { link: imageUrl, ...(caption ? { caption } : {}) },
    }),
  });
  if (!response.ok) {
    const raw = await response.json();
    const e = new Error(`WhatsApp API Error: ${JSON.stringify(raw)}`) as any;
    e.metaError = parseMetaError(raw);
    throw e;
  }
  return response.json();
}

export async function sendVideoMessage(
  phoneNumberId: string,
  to: string,
  videoUrl: string,
  caption: string | undefined,
  accessToken: string
) {
  const response = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "video",
      video: { link: videoUrl, ...(caption ? { caption } : {}) },
    }),
  });
  if (!response.ok) {
    const raw = await response.json();
    const e = new Error(`WhatsApp API Error: ${JSON.stringify(raw)}`) as any;
    e.metaError = parseMetaError(raw);
    throw e;
  }
  return response.json();
}

export async function sendDocumentMessage(
  phoneNumberId: string,
  to: string,
  docUrl: string,
  filename: string,
  caption: string | undefined,
  accessToken: string
) {
  const response = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "document",
      document: { link: docUrl, filename, ...(caption ? { caption } : {}) },
    }),
  });
  if (!response.ok) {
    const raw = await response.json();
    const e = new Error(`WhatsApp API Error: ${JSON.stringify(raw)}`) as any;
    e.metaError = parseMetaError(raw);
    throw e;
  }
  return response.json();
}

// ─── Phone number info & quality ─────────────────────────────────────────────

export async function getPhoneNumberInfo(phoneNumberId: string, accessToken: string) {
  const response = await fetch(
    `${WA_API_URL}/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating,messaging_limit_tier,account_mode`,
    { headers: { "Authorization": `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`WhatsApp API Error: ${JSON.stringify(error)}`);
  }

  return response.json();
}

export async function getMessageTemplates(wabaId: string, accessToken: string) {
  const response = await fetch(`${WA_API_URL}/${wabaId}/message_templates`, {
    headers: { "Authorization": `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`WhatsApp API Error: ${JSON.stringify(error)}`);
  }

  return response.json();
}

/**
 * Fetch the current quality rating and messaging tier for a phone number.
 * Returns null on failure so callers can degrade gracefully.
 */
export async function getPhoneNumberQuality(
  phoneNumberId: string,
  accessToken: string
): Promise<{ qualityRating: string; tier: string; dailyLimit: number; messagingTier: number } | null> {
  try {
    const data = await getPhoneNumberInfo(phoneNumberId, accessToken);
    // Meta returns e.g. "GREEN", "YELLOW", "RED", "UNKNOWN"
    const qualityRating: string = data.quality_rating ?? "UNKNOWN";
    // messaging_limit_tier values are not sequential — see messaging-limits.ts.
    const { tier, dailyLimit } = parseMessagingTier(data.messaging_limit_tier);
    return { qualityRating, tier, dailyLimit, messagingTier: tierOrdinal(tier) };
  } catch {
    return null;
  }
}
