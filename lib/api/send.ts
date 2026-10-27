import { buildOtpSendComponents, isValidOtpCode } from "@/lib/whatsapp/template-builder";
import { refreshWaTokenIfNeeded } from "@/lib/whatsapp/token";
import type { OpResult } from "@/lib/api/ops";
import { normalizePhone, phoneVariants } from "@/lib/whatsapp/phone";
import { addressTo, isBsuid } from "@/lib/whatsapp/service";

const WA_API_URL = "https://graph.facebook.com/v25.0";
const fail = (status: number, error: string, code?: string): OpResult<never> => ({ ok: false, status, error, code });

export interface SendInput {
  phone: string;
  type?: "text" | "template" | "otp";
  text?: string;
  template?: string;
  language?: string;
  params?: string[];
  otp?: string;
}

/**
 * Sends one message for the REST API and the MCP server.
 * Guards against the mistakes that otherwise only surface as Meta errors:
 * free text outside the 24-hour window, opted-out contacts, unapproved or
 * missing templates, and OTP code spamming.
 */
export async function sendApiMessage(db: any, userId: string, input: SendInput): Promise<OpResult<{ message_id: string | null; to: string }>> {
  // Customers with a WhatsApp username may only be reachable by a business-scoped user id.
  const bsuid = isBsuid(String(input.phone ?? ""));
  const digits = bsuid ? String(input.phone) : normalizePhone(input.phone);
  if (!digits) return fail(400, "phone must include the country code, for example +919876543210.");
  const to = digits;

  const { data: conn } = await db.from("wa_connections")
    .select("phone_number_id, access_token, token_expires_at, status, quality_paused_at")
    .eq("user_id", userId).eq("status", "active").maybeSingle();
  if (!conn) return fail(400, "WhatsApp is not connected. Connect your number in the dashboard first.", "NOT_CONNECTED");

  const isOtp = input.type === "otp" || input.otp !== undefined;
  if (isOtp && bsuid) return fail(400, "Verification codes cannot be sent to this customer because WhatsApp is hiding their phone number.", "OTP_NEEDS_PHONE");
  const isText = !isOtp && (input.type === "text" || (!input.template?.trim() && !!input.text));

  // Consent: a code requested by the person is always allowed; anything else respects STOP.
  if (!isOtp) {
    const { data: contact } = await db.from("wa_contacts").select("is_opted_in").eq("user_id", userId).in("phone_number", phoneVariants(digits)).limit(1).maybeSingle();
    if (contact?.is_opted_in === false) {
      return fail(403, "This contact opted out. Messaging resumes only if they text START.", "OPTED_OUT");
    }
  }

  let payload: Record<string, unknown>;

  if (isOtp) {
    if (!isValidOtpCode(input.otp)) return fail(400, 'otp must be 4 to 15 letters or digits, for example "482913".');
    let q = db.from("wa_templates").select("name, language").eq("user_id", userId).eq("category", "AUTHENTICATION").eq("status", "approved");
    if (input.template) q = q.eq("name", input.template);
    const { data: tpl } = await q.limit(1).maybeSingle();
    if (!tpl) return fail(400, "No approved verification template. Create one under Message templates > Verification code (OTP) and wait for Meta to approve it.", "OTP_TEMPLATE_REQUIRED");

    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await db.from("wa_messages").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("to_phone", digits).eq("content", "[Verification code sent]").gte("created_at", since);
    if ((count ?? 0) >= 5) return fail(429, "Too many codes sent to this number. Try again in a few minutes.", "OTP_RATE_LIMIT");

    payload = { messaging_product: "whatsapp", ...addressTo(to), type: "template",
      template: { name: tpl.name, language: { code: tpl.language || "en_US" }, components: buildOtpSendComponents(input.otp!) } };
  } else if (isText) {
    if (!input.text?.trim()) return fail(400, "text is required for a text message.");
    // Free text only works while the customer's chat window is open.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await db.from("wa_messages").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("from_phone", digits).eq("direction", "inbound").gte("created_at", since);
    const { data: c } = await db.from("wa_contacts").select("ctwa_window_expires_at").eq("user_id", userId).in("phone_number", phoneVariants(digits)).limit(1).maybeSingle();
    const adWindow = c?.ctwa_window_expires_at && new Date(c.ctwa_window_expires_at) > new Date();
    if ((count ?? 0) === 0 && !adWindow) {
      return fail(409, "This customer has not messaged you in the last 24 hours, so WhatsApp will not deliver free text. Send an approved template instead.", "OUTSIDE_24H_WINDOW");
    }
    payload = { messaging_product: "whatsapp", recipient_type: "individual", ...addressTo(to), type: "text", text: { body: input.text } };
  } else {
    if (!input.template?.trim()) return fail(400, "Provide template (a template name), or type \"text\" with text.");
    const { data: tpl } = await db.from("wa_templates").select("name, language, status, category")
      .eq("user_id", userId).eq("name", input.template.trim()).limit(1).maybeSingle();
    if (!tpl) return fail(404, `No template named "${input.template}". List templates to see what you have.`, "TEMPLATE_NOT_FOUND");
    if (tpl.status !== "approved") return fail(409, `Template "${tpl.name}" is ${tpl.status}, not approved by Meta yet.`, "TEMPLATE_NOT_APPROVED");
    if (tpl.category === "AUTHENTICATION") return fail(400, 'Use type "otp" with the code for verification templates.');
    if (conn.quality_paused_at && tpl.category === "MARKETING") {
      return fail(403, "Marketing messages are paused because your number quality is low.", "QUALITY_LOW");
    }
    const params = Array.isArray(input.params) ? input.params.map(String) : [];
    if (params.some((p) => !p.trim())) return fail(400, "params cannot contain empty values.");
    payload = { messaging_product: "whatsapp", ...addressTo(to), type: "template",
      template: { name: tpl.name, language: { code: input.language || tpl.language || "en_US" },
        ...(params.length ? { components: [{ type: "body", parameters: params.map((p) => ({ type: "text", text: p })) }] } : {}) } };
  }

  const token = await refreshWaTokenIfNeeded(db, { access_token: conn.access_token, token_expires_at: conn.token_expires_at, phone_number_id: conn.phone_number_id });
  const res = await fetch(`${WA_API_URL}/${conn.phone_number_id}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data?.error;
    const hint = e?.code === 131047 ? " The 24-hour window is closed; use a template." : e?.code === 131049 ? " Meta limited promotions to this person." : e?.code === 131042 ? " Add a payment method in Meta Business Manager." : "";
    return fail(502, `WhatsApp rejected the message: ${e?.error_user_msg || e?.message || "unknown error"}.${hint}`, "WHATSAPP_ERROR");
  }

  const messageId: string | null = data?.messages?.[0]?.id ?? null;
  await db.from("wa_messages").insert({
    user_id: userId, wa_message_id: messageId, to_phone: digits, direction: "outbound",
    message_type: isText ? "text" : "template",
    content: isOtp ? "[Verification code sent]" : isText ? input.text : `[Template] ${input.template}`,
    status: "sent",
  });
  return { ok: true, data: { message_id: messageId, to: bsuid ? digits : `+${digits}` } };
}
