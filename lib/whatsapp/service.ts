import { env } from "@/lib/env";

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

export interface MetaApiError {
  code: number;
  message: string;
  type?: string;
  fbtrace_id?: string;
  isTokenExpired: boolean;
  isRateLimit: boolean;
  isUnreachable: boolean;
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
  };
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
): Promise<{ qualityRating: string; messagingTier: number } | null> {
  try {
    const data = await getPhoneNumberInfo(phoneNumberId, accessToken);
    // Meta returns e.g. "HIGH", "MEDIUM", "LOW", "UNKNOWN"
    const qualityRating: string = data.quality_rating ?? "UNKNOWN";
    // messaging_limit_tier: "TIER_1" (1k/day), "TIER_2" (10k), "TIER_3" (100k), "TIER_4" (unlimited)
    const tierStr: string = data.messaging_limit_tier ?? "TIER_1";
    const messagingTier = parseInt(tierStr.replace("TIER_", ""), 10) || 1;
    return { qualityRating, messagingTier };
  } catch {
    return null;
  }
}
