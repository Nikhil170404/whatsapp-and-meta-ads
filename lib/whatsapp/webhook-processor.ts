/**
 * Processes one WhatsApp webhook payload: inbound messages, delivery receipts, template
 * and account events. Called by the worker from the event queue (and inline as a fallback),
 * so the web endpoint itself only has to verify and store the payload.
 */
import {
  sendTextMessage,
  sendButtonMessage,
  sendListMessage,
  markReadWithTyping,
  sendImageMessage,
  sendVideoMessage,
  sendDocumentMessage,
} from "@/lib/whatsapp/service";
import { refreshWaTokenIfNeeded } from "@/lib/whatsapp/token";
import { recordConsent, recordMarketingPreference } from "@/lib/consent";
import { describeInbound, extractInboundText, pickAutomation } from "@/lib/whatsapp/flow";
import { DEFAULT_AWAY_MESSAGE, shouldSendAway } from "@/lib/whatsapp/hours";
import { handleFlowInbound } from "@/lib/flows/runtime";
import { whatsappFlowSender } from "@/lib/flows/sender";
import { supabaseFlowStore } from "@/lib/flows/store";
import type { Inbound } from "@/lib/flows/engine";
import { parseAccountUpdate } from "@/lib/whatsapp/enforcement";

// 24-hour window in milliseconds — Meta only allows free-form text within this
// window after the customer's last inbound message. Outside it, use templates.
const CUSTOMER_WINDOW_MS = 24 * 60 * 60 * 1000;


export async function processWebhookBody(supabase: any, body: any) {
  for (const entry of body.entry) {
    for (const change of entry.changes) {
      // ── Quality-rating update ────────────────────────────────────────────
      // Despite its name this webhook reports the messaging LIMIT (and throughput) changing
      // (current_limit / max_daily_conversations_per_business, e.g. TIER_2K). Quality is read
      // from the Graph API by the quality-sync job.
      if (change.field === "phone_number_quality_update") {
        await handleLimitUpdate(supabase, entry.id, change.value);
        continue;
      }

      // ── Policy enforcement: violations, timed restrictions, bans ─────────
      if (change.field === "account_update") {
        await handleAccountUpdate(supabase, entry.id, change.value);
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
        await handleTemplateStatusUpdate(supabase, entry.id, change.value);
        continue;
      }

      // ── Meta changed a template's category (this changes what it costs) ──
      if (change.field === "template_category_update") {
        await handleTemplateCategoryUpdate(supabase, entry.id, change.value);
        continue;
      }

      // ── Customer stopped/resumed marketing from WhatsApp's own settings ──
      if (change.field === "user_preferences") {
        await handleUserPreferences(supabase, entry.id, change.value);
        continue;
      }

      // ── Template quality update ──────────────────────────────────────────
      if (change.field === "message_template_quality_update") {
        await handleTemplateQualityUpdate(supabase, entry.id, change.value);
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
}

// ─── Quality update handler ──────────────────────────────────────────────────

async function handleLimitUpdate(supabase: any, wabaId: string, value: any) {
  const tier: string | undefined = value.max_daily_conversations_per_business ?? value.current_limit;
  if (!tier) return;

  // The event names the number by its display phone number; match it to this account's connection.
  const digits = String(value.display_phone_number ?? "").replace(/\D/g, "");
  const { data: conns } = await supabase.from("wa_connections").select("user_id, phone_number").eq("waba_id", wabaId);
  const match = (conns ?? []).find((c: any) => !digits || String(c.phone_number ?? "").replace(/\D/g, "") === digits) ?? (conns ?? [])[0];
  if (!match) return;

  await supabase.from("wa_connections").update({ messaging_limit_tier: tier, quality_synced_at: new Date().toISOString() }).eq("user_id", match.user_id);
}

// ─── Policy enforcement (account_update) ─────────────────────────────────────

async function handleAccountUpdate(supabase: any, wabaId: string, value: any) {
  const state = parseAccountUpdate(value);
  if (!state) return;

  const userId = await userIdForWaba(supabase, wabaId);
  if (!userId) return;

  if (!state.summary && !state.blocksBusinessInitiated) {
    // Reinstated: clear any earlier restriction.
    await supabase.from("wa_connections").update({ restriction_summary: null, restriction_blocks: false, restricted_until: null }).eq("user_id", userId);
    return;
  }

  await supabase.from("wa_connections").update({
    restriction_summary: state.summary,
    restriction_blocks: state.blocksBusinessInitiated,
    restricted_until: state.until ? state.until.toISOString() : null,
    last_error: state.summary,
    last_error_at: new Date().toISOString(),
  }).eq("user_id", userId);

  // Stop automatic sending while Meta has the account restricted, so we never make it worse.
  if (state.blocksBusinessInitiated) {
    await supabase.from("wa_broadcasts").update({ status: "paused", error: state.summary, locked_at: null })
      .eq("user_id", userId).in("status", ["queued", "sending", "scheduled"]);
  }
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

// ─── Template handlers ───────────────────────────────────────────────────────
// Template names are only unique per account, so every update is scoped to the
// account that owns the WABA that sent the event.

async function userIdForWaba(supabase: any, wabaId: string): Promise<string | null> {
  const { data } = await supabase.from("wa_connections").select("user_id").eq("waba_id", wabaId).maybeSingle();
  return data?.user_id ?? null;
}

async function handleTemplateStatusUpdate(supabase: any, wabaId: string, value: any) {
  const templateName: string = value.message_template_name ?? "";
  const event: string = (value.event ?? "").toLowerCase(); // approved / rejected / disabled / paused / pending...
  if (!templateName || !event) return;

  const userId = await userIdForWaba(supabase, wabaId);
  if (!userId) return;

  const rejected = event === "rejected" || event === "disabled";
  const reason = value.reason && value.reason !== "NONE" ? String(value.reason) : null;

  let q = supabase
    .from("wa_templates")
    .update({ status: event, rejection_reason: rejected ? reason : null })
    .eq("user_id", userId)
    .eq("name", templateName);
  if (value.message_template_language) q = q.eq("language", value.message_template_language);
  await q;
}

async function handleTemplateCategoryUpdate(supabase: any, wabaId: string, value: any) {
  const templateName: string = value.message_template_name ?? "";
  const category: string = (value.new_category ?? "").toUpperCase();
  if (!templateName || !["MARKETING", "UTILITY", "AUTHENTICATION"].includes(category)) return;

  const userId = await userIdForWaba(supabase, wabaId);
  if (!userId) return;

  await supabase.from("wa_templates").update({ category }).eq("user_id", userId).eq("name", templateName);
}

async function handleTemplateQualityUpdate(supabase: any, wabaId: string, value: any) {
  const templateName: string = value.message_template_name ?? "";
  const qualityScore: string = value.new_quality_score ?? "UNKNOWN";
  if (!templateName) return;

  const userId = await userIdForWaba(supabase, wabaId);
  if (!userId) return;

  if (qualityScore === "LOW") {
    // Pause use of a template Meta flags as low quality.
    await supabase.from("wa_templates").update({ status: "low_quality" }).eq("user_id", userId).eq("name", templateName).eq("status", "approved");
  } else if (qualityScore === "HIGH" || qualityScore === "MEDIUM") {
    // Quality recovered: make it usable again.
    await supabase.from("wa_templates").update({ status: "approved" }).eq("user_id", userId).eq("name", templateName).eq("status", "low_quality");
  }
}

// ─── Customer marketing preference (from WhatsApp's own settings) ────────────

async function handleUserPreferences(supabase: any, wabaId: string, value: any) {
  const userId = await userIdForWaba(supabase, wabaId);
  if (!userId) return;

  const person = value.contacts?.[0];
  const key: string | undefined = person?.wa_id ?? person?.user_id;
  if (!key) return;

  for (const pref of value.user_preferences ?? []) {
    if (pref.category !== "marketing_messages" || !["stop", "resume"].includes(pref.value)) continue;
    await recordMarketingPreference(supabase, {
      userId,
      phoneNumber: key,
      value: pref.value,
      evidence: { detail: pref.detail ?? null, timestamp: pref.timestamp ?? null },
    });
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

      // Keep broadcast delivered/read/failed counters in step with receipts.
      await supabase.rpc("apply_broadcast_receipt", {
        p_wa_message_id: status.id,
        p_status: status.status,
      });
    }
  }

  // Process incoming messages
  if (!value.messages?.length) return;

  for (const message of value.messages) {
    // Customers with a WhatsApp username may have no phone number in the webhook;
    // Meta then identifies them by a business-scoped user ID, which we use instead.
    const person = value.contacts?.[0];
    const contact: string = person?.wa_id ?? person?.user_id ?? message.from ?? message.user_id;
    if (!contact) continue;
    // Identity-change notices (for example a customer changing number) are not conversation.
    if (message.type === "system") continue;

    // Typed text, or the label of a tapped button / list option, so taps can
    // continue a flow exactly like a typed keyword.
    const inbound = extractInboundText(message);
    const content = describeInbound(message);

    // Find the connected user by phone_number_id
    const cols = "user_id, access_token, token_expires_at, quality_paused_at, hours_enabled, hours, hours_timezone, away_message";
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
      await recordConsent(supabase, {
        userId: connection.user_id,
        phoneNumber: contact,
        action: "withdrawn",
        source: "whatsapp_keyword",
        evidence: { keyword: content.slice(0, 40), wa_message_id: message.id },
      });
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
      ["start", "subscribe", "opt in", "optin"].includes(
        content.toLowerCase().trim()
      )
    ) {
      await recordConsent(supabase, {
        userId: connection.user_id,
        phoneNumber: contact,
        action: "granted",
        source: "whatsapp_keyword",
        purposes: ["service_messages", "marketing_messages"],
        evidence: { keyword: content.slice(0, 40), wa_message_id: message.id },
      });
    }

    // ── Record opt-in on first contact ──────────────────────────────────────
    const { data: existingContact } = await supabase
      .from("wa_contacts")
      .select("opted_in_at")
      .eq("user_id", connection.user_id)
      .eq("phone_number", contact)
      .maybeSingle();
    if (existingContact && !existingContact.opted_in_at) {
      // Customer-initiated contact: consent for service replies only.
      await recordConsent(supabase, {
        userId: connection.user_id,
        phoneNumber: contact,
        action: "granted",
        source: "whatsapp_first_contact",
        purposes: ["service_messages"],
        evidence: { wa_message_id: message.id },
      });
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

    // ── Run automations on typed text and on button / list taps ──────────────
    // Location shares have no text but a flow can be waiting for one.
    if (!inbound && message.type !== "location") continue;

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

    // No automations is fine: the away message below can still apply.

    // First-ever inbound message detection (for "welcome" trigger)
    const { count: priorCount } = await supabase
      .from("wa_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", connection.user_id)
      .eq("from_phone", contact)
      .eq("direction", "inbound");

    const isFirstMessage = (priorCount ?? 0) <= 1;

    // ── Conversation flows come first: a flow in progress owns the conversation ──
    const flowInbound: Inbound =
      message.type === "location" ? { kind: "location", latitude: Number(message.location?.latitude), longitude: Number(message.location?.longitude), name: message.location?.name, address: message.location?.address }
      : inbound?.isTap && inbound.replyId ? { kind: "reply", id: inbound.replyId, title: inbound.text }
      : inbound ? { kind: "text", text: inbound.text }
      : { kind: "other" };
    try {
      const handledByFlow = await handleFlowInbound(
        { store: supabaseFlowStore(supabase), sender: whatsappFlowSender({ phoneNumberId, token: validToken, to: contact }) },
        { userId: connection.user_id, phone: contact, contactName: person?.profile?.name ?? null, inbound: flowInbound, messageId: message.id, isFirstMessage }
      );
      if (handledByFlow) continue;
    } catch (err) {
      console.error("Flow handling failed, falling back to automations:", err);
    }
    if (!inbound) continue; // a location or media message that no flow was waiting for

    const matchedAutomation: any = pickAutomation((automations ?? []) as any[], inbound, isFirstMessage);

    if (!matchedAutomation) {
      // Nothing answered, and the business is closed: tell the customer when to expect a reply (once per 12 hours).
      const { data: awayContact } = await supabase.from("wa_contacts").select("last_away_at")
        .eq("user_id", connection.user_id).eq("phone_number", contact).maybeSingle();
      if (shouldSendAway({
        enabled: connection.hours_enabled === true, week: connection.hours, timeZone: connection.hours_timezone,
        lastAwayAt: awayContact?.last_away_at,
      })) {
        const awayText: string = connection.away_message || DEFAULT_AWAY_MESSAGE;
        try {
          await markReadWithTyping(phoneNumberId, message.id, validToken);
          const sent = await sendTextMessage(phoneNumberId, contact, awayText, validToken);
          await supabase.from("wa_contacts").update({ last_away_at: new Date().toISOString() })
            .eq("user_id", connection.user_id).eq("phone_number", contact);
          await supabase.from("wa_messages").insert({
            user_id: connection.user_id, wa_message_id: sent?.messages?.[0]?.id ?? `away-${Date.now()}`,
            from_phone: value.metadata.display_phone_number, to_phone: contact, direction: "outbound",
            message_type: "text", content: awayText, status: "sent",
          });
        } catch (err) {
          console.error("Failed to send away message:", err);
        }
      }
      continue;
    }

    // Blue ticks and "typing…" while the reply is prepared.
    await markReadWithTyping(phoneNumberId, message.id, validToken);

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
      } else if (msgType === "list") {
        response = await sendListMessage(
          phoneNumberId, contact,
          matchedAutomation.reply_message,
          matchedAutomation.button_options?.list_button || "View options",
          matchedAutomation.button_options?.rows || [],
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
          : msgType === "list"
          ? `[Menu] ${matchedAutomation.reply_message}`
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

      // Clear any stale connection error on success
      await supabase
        .from("wa_connections")
        .update({ last_error: null, last_error_at: null })
        .eq("phone_number_id", phoneNumberId);
    } catch (error: any) {
      console.error("Failed to send WA auto-reply:", error);

      // Parse Meta error for clean display
      let errorMsg = error?.message || "Unknown error sending reply";
      const metaErr = error?.metaError;
      if (metaErr) {
        errorMsg = `(#${metaErr.code}) ${metaErr.message}`;
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
