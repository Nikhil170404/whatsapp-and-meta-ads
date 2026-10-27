
const WA_API_URL = "https://graph.facebook.com/v25.0";

// ─── Meta error codes (see lib/whatsapp/errors.ts for what to do about each) ──
// Token expired / access denied
export const TOKEN_EXPIRED_CODES = new Set([190, 131005]);

// The recipient cannot be reached or must not be messaged. Not a quality problem.
export const UNREACHABLE_CODES = new Set([
  131026, // Undeliverable: not on WhatsApp, or outdated app
  131047, // More than 24 hours since the customer last replied: use a template
  131050, // Customer stopped marketing messages from this business
  131049, // Marketing message withheld to protect the customer ("healthy ecosystem")
  63049,  // Marketing templates to US numbers are blocked
]);

// Slow down and retry. 131056 is a per-recipient limit and is NOT an opt-out.
export const RATE_LIMIT_CODES = new Set([
  130429, // Cloud API throughput reached
  80007,  // WhatsApp Business Account rate limit
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

// ─── Recipient addressing ────────────────────────────────────────────────────
// WhatsApp users who adopt a username may have no visible phone number. Meta then
// identifies them by a business-scoped user ID (BSUID, e.g. "IN.13491208655302741918")
// and accepts it in `recipient` instead of `to`.
const BSUID_RE = /^[A-Z]{2}\.(?:ENT\.)?[A-Za-z0-9]{1,128}$/;

export const isBsuid = (target: string) => BSUID_RE.test(target);

export function addressTo(target: string): { to: string } | { recipient: string } {
  return isBsuid(target) ? { recipient: target } : { to: target };
}

/**
 * Marks an inbound message as read (blue ticks) and shows "typing…" until the
 * reply arrives. Best effort: a failure here must never block the reply.
 */
export async function markReadWithTyping(phoneNumberId: string, messageId: string, accessToken: string) {
  try {
    await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
        typing_indicator: { type: "text" },
      }),
    });
  } catch {
    /* cosmetic only */
  }
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
    signal: AbortSignal.timeout(20_000),
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      ...addressTo(to),
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
    signal: AbortSignal.timeout(20_000),
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      ...addressTo(to),
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
    signal: AbortSignal.timeout(20_000),
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      ...addressTo(to),
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

export async function sendListMessage(
  phoneNumberId: string,
  to: string,
  bodyText: string,
  listButton: string,
  rows: { id: string; title: string; description?: string }[],
  accessToken: string
) {
  const response = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      ...addressTo(to),
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: bodyText },
        action: {
          button: listButton,
          sections: [
            {
              title: "Options",
              rows: rows.map(r => ({
                id: r.id,
                title: r.title,
                ...(r.description ? { description: r.description } : {}),
              })),
            },
          ],
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

export async function sendLocationRequest(
  phoneNumberId: string,
  to: string,
  bodyText: string,
  accessToken: string
) {
  const response = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    signal: AbortSignal.timeout(20_000),
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      ...addressTo(to),
      type: "interactive",
      interactive: { type: "location_request_message", body: { text: bodyText }, action: { name: "send_location" } },
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
    signal: AbortSignal.timeout(20_000),
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      ...addressTo(to),
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
    signal: AbortSignal.timeout(20_000),
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      ...addressTo(to),
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
    signal: AbortSignal.timeout(20_000),
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      ...addressTo(to),
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
): Promise<{ qualityRating: string; messagingLimitTier: string } | null> {
  try {
    const data = await getPhoneNumberInfo(phoneNumberId, accessToken);
    // Raw values as Meta reports them: quality GREEN / YELLOW / RED / NA, limit TIER_250 ... TIER_UNLIMITED.
    // They are interpreted in lib/whatsapp/limits.ts.
    return {
      qualityRating: String(data.quality_rating ?? "NA"),
      messagingLimitTier: String(data.messaging_limit_tier ?? "TIER_NOT_SET"),
    };
  } catch {
    return null;
  }
}
