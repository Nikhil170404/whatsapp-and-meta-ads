import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  sendTextMessage,
  sendButtonMessage,
  sendImageMessage,
  sendVideoMessage,
  sendDocumentMessage,
  describeMetaError,
} from "@/lib/whatsapp/service";
import { refreshWaTokenIfNeeded } from "@/lib/whatsapp/token";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { verifyMetaSignature } from "@/lib/meta-signature";

// 24-hour window in milliseconds — Meta only allows free-form text within this
// window after the customer's last inbound message. Outside it, use templates.
const CUSTOMER_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === env.WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    if (!verifyMetaSignature(rawBody, req.headers.get("x-hub-signature-256"))) {
      return new NextResponse("Invalid signature", { status: 401 });
    }

    const body = JSON.parse(rawBody);

    if (body.object !== "whatsapp_business_account") {
      return new NextResponse("Not Found", { status: 404 });
    }

    const supabase = getSupabaseAdmin() as any;

    for (const entry of body.entry) {
      for (const change of entry.changes) {
        // ── Quality-rating update ────────────────────────────────────────────
        // Meta fires this when phone number quality changes (HIGH/MEDIUM/LOW).
        // LOW quality means too many users are blocking/reporting messages.
        if (change.field === "phone_number_quality_update") {
          await handleQualityUpdate(supabase, change.value);
          continue;
        }

        // ── Account-level alerts ─────────────────────────────────────────────
        // Fires before account restrictions or ban events.
        if (change.field === "account_alerts") {
          await handleAccountAlert(supabase, entry.id, change.value);
          continue;
        }

        // ── Template approval / rejection ────────────────────────────────────
        if (change.field === "message_template_status_update") {
          await handleTemplateStatusUpdate(supabase, change.value);
          continue;
        }

        // ── Template quality update ──────────────────────────────────────────
        if (change.field === "message_template_quality_update") {
          await handleTemplateQualityUpdate(supabase, change.value);
          continue;
        }

        // ── Inbound messages & delivery receipts ─────────────────────────────
        // entry.id is the WABA ID — used as a fallback key when the stored
        // phone_number_id is stale or wrong.
        if (change.field === "messages") {
          await handleMessagesChange(supabase, change.value, entry.id);
        }
      }
    }

    return new NextResponse("EVENT_RECEIVED", { status: 200 });
  } catch (error) {
    console.error("WA Webhook Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// ─── Quality update handler ──────────────────────────────────────────────────

async function handleQualityUpdate(supabase: any, value: any) {
  const phoneNumberId: string = value.phone_number_id ?? value.display_phone_number;
  const newRating: string = value.current_limit ?? value.quality_score?.score ?? "UNKNOWN";

  if (!phoneNumberId) return;

  const { data: conn } = await supabase
    .from("wa_connections")
    .select("user_id, quality_paused_at")
    .eq("phone_number_id", phoneNumberId)
    .single();

  if (!conn) return;

  const isLow = newRating === "LOW";
  const update: Record<string, any> = {
    quality_rating: newRating,
    quality_synced_at: new Date().toISOString(),
  };

  if (isLow && !conn.quality_paused_at) {
    // Quality just dropped to LOW — pause all automations immediately
    update.quality_paused_at = new Date().toISOString();
    update.last_error = "Automations auto-paused: phone number quality is LOW. Too many users are blocking or reporting messages. Improve content quality before re-enabling.";
    update.last_error_at = new Date().toISOString();

    await supabase
      .from("wa_automations")
      .update({ is_active: false, last_error: "Auto-paused: phone number quality is LOW (Meta policy protection)" })
      .eq("user_id", conn.user_id)
      .eq("is_active", true);

    console.warn(`[webhook] Quality dropped to LOW for phone_number_id=${phoneNumberId}`);
  } else if (!isLow && conn.quality_paused_at) {
    // Quality recovered
    update.quality_paused_at = null;
    update.last_error = null;
    update.last_error_at = null;
  }

  await supabase
    .from("wa_connections")
    .update(update)
    .eq("phone_number_id", phoneNumberId);
}

// ─── Account alert handler ───────────────────────────────────────────────────

async function handleAccountAlert(supabase: any, wabaId: string, value: any) {
  const alertType: string = value.type ?? value.alert_type ?? "unknown";
  const description: string = value.description ?? value.message ?? "";

  await supabase
    .from("wa_connections")
    .update({
      last_error: `Meta account alert (${alertType}): ${description}`,
      last_error_at: new Date().toISOString(),
    })
    .eq("waba_id", wabaId);

  console.warn(`[webhook] Account alert for waba_id=${wabaId}: ${alertType} — ${description}`);
}

// ─── Template status update handler ─────────────────────────────────────────

async function handleTemplateStatusUpdate(supabase: any, value: any) {
  const templateName: string = value.message_template_name ?? "";
  const newStatus: string = (value.event ?? "").toLowerCase(); // APPROVED / REJECTED / DISABLED

  if (!templateName) return;

  await supabase
    .from("wa_templates")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("name", templateName);
}

// ─── Template quality update handler ────────────────────────────────────────

async function handleTemplateQualityUpdate(supabase: any, value: any) {
  const templateName: string = value.message_template_name ?? "";
  const qualityScore: string = value.new_quality_score ?? "UNKNOWN";

  if (!templateName) return;

  // If Meta flags a template as LOW quality, pause it to prevent further use
  if (qualityScore === "LOW") {
    await supabase
      .from("wa_templates")
      .update({ status: "low_quality" })
      .eq("name", templateName);
  }
}

// ─── Messages change handler (inbound messages + delivery receipts) ──────────

async function handleMessagesChange(supabase: any, value: any, wabaId?: string) {
  const phoneNumberId: string = value.metadata.phone_number_id;

  // Process statuses (delivery / read receipts)
  if (value.statuses?.length > 0) {
    for (const status of value.statuses) {
      const update: Record<string, any> = { status: status.status };

      // Capture error details from failed delivery status
      if (status.errors?.length > 0) {
        const err = status.errors[0];
        update.error_code = err.code;
        update.error_message = err.title ?? err.message ?? "";
      }

      await supabase
        .from("wa_messages")
        .update(update)
        .eq("wa_message_id", status.id);
    }
  }

  // Process incoming messages
  if (!value.messages?.length) return;

  for (const message of value.messages) {
    const contact: string = value.contacts?.[0]?.wa_id;
    if (!contact) continue;

    const content =
      message.type === "text" ? message.text.body : `[${message.type} message]`;

    // Find the connected user by phone_number_id
    const cols = "user_id, access_token, token_expires_at, billing_type, quality_paused_at";
    let { data: connection } = await supabase
      .from("wa_connections")
      .select(cols)
      .eq("phone_number_id", phoneNumberId)
      .single();

    // Fall back to the WABA ID when the stored phone_number_id is stale or wrong,
    // then correct it from the webhook payload — which carries the authoritative
    // value — so subsequent lookups hit on the first try.
    if (!connection && wabaId) {
      const { data: byWaba } = await supabase
        .from("wa_connections")
        .select(cols)
        .eq("waba_id", wabaId)
        .single();

      if (byWaba) {
        await supabase
          .from("wa_connections")
          .update({ phone_number_id: phoneNumberId, updated_at: new Date().toISOString() })
          .eq("user_id", byWaba.user_id);
        console.warn(`[webhook] Repaired phone_number_id for waba_id=${wabaId} -> ${phoneNumberId}`);
        connection = byWaba;
      }
    }

    if (!connection) continue;

    // Auto-refresh token if expiring within 30 days
    const validToken = await refreshWaTokenIfNeeded(supabase, {
      ...connection,
      phone_number_id: phoneNumberId,
    });

    // Update last customer message timestamp for 24-hour window tracking.
    // CTWA contacts (referral.source_type === "ad") get a 72-hour window instead.
    const messageTimestamp = new Date(Number(message.timestamp) * 1000).toISOString();
    const referral = message.referral;
    const isCTWA = referral?.source_type === "ad";
    const ctwaWindowExpiresAt = isCTWA
      ? new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
      : undefined;

    await supabase
      .from("wa_contacts")
      .upsert(
        {
          user_id: connection.user_id,
          phone_number: contact,
          last_customer_message_at: messageTimestamp,
          last_message_at: messageTimestamp,
          ...(ctwaWindowExpiresAt && { ctwa_window_expires_at: ctwaWindowExpiresAt }),
        },
        { onConflict: "user_id,phone_number" }
      );

    // ── Opt-out / STOP handling ──────────────────────────────────────────────
    const stopWords = [
      "stop", "unsubscribe", "opt out", "optout", "remove me",
      "cancel subscription", "no messages",
    ];
    const isOptOut =
      message.type === "text" &&
      stopWords.some(
        w =>
          content.toLowerCase().trim() === w ||
          content.toLowerCase().trim().startsWith(w + " ")
      );

    if (isOptOut) {
      await supabase.from("wa_contacts").upsert(
        {
          user_id: connection.user_id,
          phone_number: contact,
          is_opted_in: false,
          opted_out_at: new Date().toISOString(),
        },
        { onConflict: "user_id,phone_number" }
      );
      try {
        await sendTextMessage(
          phoneNumberId,
          contact,
          "You've been unsubscribed from our messages. Reply START any time to opt back in.",
          validToken
        );
      } catch {}
      continue;
    }

    // ── Opt-in / START handling ──────────────────────────────────────────────
    if (
      message.type === "text" &&
      ["start", "subscribe", "opt in", "optin", "yes"].includes(
        content.toLowerCase().trim()
      )
    ) {
      await supabase.from("wa_contacts").upsert(
        {
          user_id: connection.user_id,
          phone_number: contact,
          is_opted_in: true,
          opted_in_at: new Date().toISOString(),
          opted_out_at: null,
        },
        { onConflict: "user_id,phone_number" }
      );
    }

    // ── Record opt-in on first contact ──────────────────────────────────────
    const { data: existingContact } = await supabase
      .from("wa_contacts")
      .select("opted_in_at")
      .eq("user_id", connection.user_id)
      .eq("phone_number", contact)
      .maybeSingle();
    if (existingContact && !existingContact.opted_in_at) {
      await supabase
        .from("wa_contacts")
        .update({ opted_in_at: new Date().toISOString() })
        .eq("user_id", connection.user_id)
        .eq("phone_number", contact);
    }

    // ── Save inbound message ─────────────────────────────────────────────────
    const { error: insertErr } = await supabase.from("wa_messages").insert({
      user_id: connection.user_id,
      wa_message_id: message.id,
      from_phone: contact,
      to_phone: value.metadata.display_phone_number,
      direction: "inbound",
      message_type: message.type,
      content: content,
      status: "delivered",
    });

    if (insertErr) {
      // 23505 = unique_violation = already processed (Meta re-delivery)
      if (insertErr.code === "23505") continue;
      console.error("Failed to save inbound message:", insertErr);
    }

    // ── Only run automations on text messages ────────────────────────────────
    if (message.type !== "text") continue;

    // Skip if opted out
    const { data: contactRow } = await supabase
      .from("wa_contacts")
      .select("is_opted_in")
      .eq("user_id", connection.user_id)
      .eq("phone_number", contact)
      .maybeSingle();
    if (contactRow?.is_opted_in === false) continue;

    // Skip automations entirely when phone number quality is LOW
    if (connection.quality_paused_at) continue;

    const { data: automations } = await supabase
      .from("wa_automations")
      .select("*")
      .eq("user_id", connection.user_id)
      .eq("is_active", true);

    if (!automations?.length) continue;

    // First-ever inbound message detection (for "welcome" trigger)
    const { count: priorCount } = await supabase
      .from("wa_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", connection.user_id)
      .eq("from_phone", contact)
      .eq("direction", "inbound");

    const isFirstMessage = (priorCount ?? 0) <= 1;

    const matchedAutomation = automations.find((a: any) => {
      if (a.trigger_type === "any") return true;
      if (a.trigger_type === "welcome") return isFirstMessage;
      if (a.trigger_type === "keyword" && a.trigger_keyword) {
        return content.toLowerCase().includes(a.trigger_keyword.toLowerCase());
      }
      return false;
    });

    if (!matchedAutomation) continue;

    // ── Managed billing: deduct BEFORE sending ───────────────────────────────
    let walletNewBal: number | null = null;
    if (connection.billing_type === "managed") {
      const { data: deducted, error: deductErr } = await supabase.rpc(
        "deduct_wallet_balance",
        { p_user_id: connection.user_id, p_amount: 95 }
      );
      if (deductErr) {
        await supabase
          .from("wa_automations")
          .update({
            last_error:
              "Wallet empty — top up your ReplyKaro wallet to resume auto-replies",
          })
          .eq("id", matchedAutomation.id);
        continue;
      }
      walletNewBal = deducted as number;
    }

    try {
      const msgType: string = matchedAutomation.message_type || "text";
      let response: any;

      if (msgType === "image") {
        response = await sendImageMessage(
          phoneNumberId, contact,
          matchedAutomation.media_url,
          matchedAutomation.reply_message || undefined,
          validToken
        );
      } else if (msgType === "video") {
        response = await sendVideoMessage(
          phoneNumberId, contact,
          matchedAutomation.media_url,
          matchedAutomation.reply_message || undefined,
          validToken
        );
      } else if (msgType === "document") {
        response = await sendDocumentMessage(
          phoneNumberId, contact,
          matchedAutomation.media_url,
          matchedAutomation.button_options?.filename || "document",
          matchedAutomation.reply_message || undefined,
          validToken
        );
      } else if (msgType === "buttons") {
        response = await sendButtonMessage(
          phoneNumberId, contact,
          matchedAutomation.reply_message,
          matchedAutomation.button_options?.buttons || [],
          validToken
        );
      } else {
        response = await sendTextMessage(
          phoneNumberId, contact,
          matchedAutomation.reply_message,
          validToken
        );
      }

      const outboundContent =
        msgType === "buttons"
          ? `[Buttons] ${matchedAutomation.reply_message}`
          : msgType !== "text"
          ? `[${msgType}] ${matchedAutomation.media_url}`
          : matchedAutomation.reply_message;

      await supabase.from("wa_messages").insert({
        user_id: connection.user_id,
        wa_message_id: response.messages?.[0]?.id || `auto-${Date.now()}`,
        from_phone: value.metadata.display_phone_number,
        to_phone: contact,
        direction: "outbound",
        message_type: msgType,
        content: outboundContent,
        status: "sent",
      });

      await supabase
        .from("wa_automations")
        .update({
          sent_count: matchedAutomation.sent_count + 1,
          last_fired_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", matchedAutomation.id);

      if (connection.billing_type === "managed" && walletNewBal !== null) {
        await supabase.from("wa_wallet_transactions").insert({
          user_id: connection.user_id,
          type: "debit",
          amount_paise: 95,
          balance_after_paise: walletNewBal,
          description: `Auto-reply to ${contact}`,
        });
      }

      // Clear any stale connection error on success
      await supabase
        .from("wa_connections")
        .update({ last_error: null, last_error_at: null })
        .eq("phone_number_id", phoneNumberId);
    } catch (error: any) {
      console.error("Failed to send WA auto-reply:", error);

      // Refund managed-billing deduction — message never sent
      if (connection.billing_type === "managed" && walletNewBal !== null) {
        const { data: w } = await supabase
          .from("wa_wallet")
          .select("balance_paise, total_spent_paise")
          .eq("user_id", connection.user_id)
          .single();
        if (w) {
          await supabase
            .from("wa_wallet")
            .update({
              balance_paise: (w.balance_paise as number) + 95,
              total_spent_paise: Math.max(0, (w.total_spent_paise as number) - 95),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", connection.user_id);
        }
      }

      // Parse Meta error for clean display
      let errorMsg = error?.message || "Unknown error sending reply";
      const metaErr = error?.metaError;
      if (metaErr) {
        // Prefer the plain-language explanation — Meta's own text for billing and
        // policy blocks does not say what the user has to do about it.
        errorMsg = describeMetaError(metaErr);
      } else {
        try {
          const parsed = JSON.parse(
            errorMsg.replace(/^WhatsApp API Error: /, "")
          );
          const e = parsed?.error;
          if (e) errorMsg = `(#${e.code}) ${e.message}`;
        } catch {}
      }

      await supabase
        .from("wa_connections")
        .update({ last_error: errorMsg, last_error_at: new Date().toISOString() })
        .eq("phone_number_id", phoneNumberId);

      await supabase
        .from("wa_automations")
        .update({ last_error: errorMsg })
        .eq("id", matchedAutomation.id);

      // Mark token expired when Meta says so
      if (metaErr?.isTokenExpired || error?.message?.includes('"code":190') || error?.message?.includes('"code":131005')) {
        await supabase
          .from("wa_connections")
          .update({ status: "expired" })
          .eq("phone_number_id", phoneNumberId);
      }
    }
  }
}
