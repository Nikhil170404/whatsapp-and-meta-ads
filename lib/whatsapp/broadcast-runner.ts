import { sendTemplateMessage, sleep } from "@/lib/whatsapp/service";
import { refreshWaTokenIfNeeded } from "@/lib/whatsapp/token";
import { hasMarketingConsent } from "@/lib/consent";
import { resolveBodyParameters } from "@/lib/whatsapp/template-builder";

// Delay between each message send to stay well under Meta's 80 msg/s API cap.
// At 200 ms we cap at ~5 msg/s — safe even on Tier 1 accounts.
const SEND_DELAY_MS = 200;

// Daily messaging limits per tier (unique users / 24 h)
const TIER_LIMITS: Record<number, number> = {
  1: 1_000,
  2: 10_000,
  3: 100_000,
  4: Infinity,
};

export interface BroadcastRunResult {
  status: number;
  body: Record<string, unknown>;
}

const json = (body: Record<string, unknown>, init?: { status?: number }): BroadcastRunResult => ({
  status: init?.status ?? 200,
  body,
});

/**
 * Sends a broadcast to its pending recipients. Shared by the dashboard API
 * route and the Railway worker so the compliance checks (opt-out, marketing
 * consent, quality gate, tier limits) live in one place.
 */
export async function runBroadcast(
  supabase: any,
  userId: string,
  broadcastId: string
): Promise<BroadcastRunResult> {
  try {
    const { data: broadcast } = await supabase
      .from("wa_broadcasts")
      .select("*")
      .eq("id", broadcastId)
      .eq("user_id", userId)
      .single();

    if (!broadcast) return json({ error: "Broadcast not found" }, { status: 404 });
    if (broadcast.status === "sending" || broadcast.status === "completed") {
      return json({ error: "Broadcast already sent" }, { status: 400 });
    }

    const { data: conn } = await supabase
      .from("wa_connections")
      .select("phone_number_id, access_token, token_expires_at, waba_id, quality_rating, messaging_tier, quality_paused_at, daily_unique_sent, daily_sent_reset_at")
      .eq("user_id", userId)
      .single();

    if (!conn) return json({ error: "WhatsApp not connected" }, { status: 400 });

    // ── Quality gate: block broadcasts when quality is LOW ──────────────────
    if (conn.quality_paused_at || conn.quality_rating === "LOW") {
      return json({
        error: "Broadcast blocked: your phone number quality rating is LOW. Sending marketing messages now would worsen your account standing. Improve quality first.",
        code: "QUALITY_LOW",
      }, { status: 403 });
    }

    // ── Token refresh ───────────────────────────────────────────────────────
    const validToken = await refreshWaTokenIfNeeded(supabase, {
      access_token: conn.access_token,
      token_expires_at: conn.token_expires_at,
      phone_number_id: conn.phone_number_id,
    });

    const { data: template } = await supabase
      .from("wa_templates")
      .select("name, language, status, body_text, category")
      .eq("id", broadcast.template_id)
      .single();

    if (!template) return json({ error: "Template not found" }, { status: 404 });

    // ── Template must be approved — never send an unapproved template ───────
    if (template.status !== "approved") {
      return json({
        error: `Template "${template.name}" is not approved by Meta (current status: ${template.status}). Only approved templates can be used in broadcasts.`,
        code: "TEMPLATE_NOT_APPROVED",
      }, { status: 400 });
    }

    // ── Get pending recipients (opted-in only) ───────────────────────────────
    const { data: recipients } = await supabase
      .from("wa_broadcast_recipients")
      .select("id, contact_id")
      .eq("broadcast_id", broadcastId)
      .eq("status", "pending");

    if (!recipients?.length) {
      return json({ error: "No pending recipients" }, { status: 400 });
    }

    // Fetch contacts — only opted-in, valid phone numbers
    const contactIds = recipients.map((r: any) => r.contact_id);
    const { data: contacts } = await supabase
      .from("wa_contacts")
      .select("id, phone_number, display_name, is_opted_in, consent_purposes")
      .eq("user_id", userId)
      .in("id", contactIds);

    // Build lookup maps; filter out opted-out contacts
    const phoneMap: Record<string, string> = {};
    const nameMap: Record<string, string> = {};
    const optedOutIds = new Set<string>();

    for (const c of contacts ?? []) {
      if (c.is_opted_in === false) {
        optedOutIds.add(c.id);
        continue;
      }
      // DPDP: promotional templates need purpose-specific marketing consent.
      if (template.category === "MARKETING" && !hasMarketingConsent(c)) {
        optedOutIds.add(c.id);
        continue;
      }
      phoneMap[c.id] = c.phone_number;
      nameMap[c.id] = c.display_name || c.phone_number;
    }

    // ── Tier-limit check ────────────────────────────────────────────────────
    const tier = conn.messaging_tier ?? 1;
    const dailyLimit = TIER_LIMITS[tier] ?? TIER_LIMITS[1];

    // Reset daily counter if it's a new day
    const lastReset = conn.daily_sent_reset_at ? new Date(conn.daily_sent_reset_at) : new Date(0);
    const now = new Date();
    const isNewDay =
      now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
      now.getUTCMonth() !== lastReset.getUTCMonth() ||
      now.getUTCDate() !== lastReset.getUTCDate();

    let dailyUsed = isNewDay ? 0 : (conn.daily_unique_sent ?? 0);

    const eligibleRecipients = recipients.filter((r: any) => !optedOutIds.has(r.contact_id));
    const remaining = dailyLimit - dailyUsed;

    if (remaining <= 0) {
      return json({
        error: `Daily messaging limit reached for Tier ${tier} (${dailyLimit.toLocaleString()} unique users/day). Try again tomorrow or upgrade your Meta messaging tier.`,
        code: "DAILY_LIMIT_REACHED",
        tier,
        dailyLimit,
        dailyUsed,
      }, { status: 429 });
    }

    const recipientsToSend = eligibleRecipients.slice(0, remaining);
    const skippedByLimit = eligibleRecipients.length - recipientsToSend.length;
    const skippedOptOut = recipients.length - eligibleRecipients.length;

    // Mark opted-out recipients as skipped immediately
    if (optedOutIds.size > 0) {
      const optedOutRecipientIds = recipients
        .filter((r: any) => optedOutIds.has(r.contact_id))
        .map((r: any) => r.id);
      await supabase
        .from("wa_broadcast_recipients")
        .update({ status: "skipped", error: "Contact opted out" })
        .in("id", optedOutRecipientIds);
    }

    // Mark tier-limited recipients as skipped
    if (skippedByLimit > 0) {
      const limitedIds = eligibleRecipients
        .slice(remaining)
        .map((r: any) => r.id);
      await supabase
        .from("wa_broadcast_recipients")
        .update({ status: "skipped", error: `Daily tier limit (Tier ${tier}: ${dailyLimit.toLocaleString()}/day) reached` })
        .in("id", limitedIds);
    }

    // Mark as sending
    await supabase
      .from("wa_broadcasts")
      .update({ status: "sending", updated_at: new Date().toISOString() })
      .eq("id", broadcastId);

    // Reset daily counter if new day
    if (isNewDay) {
      await supabase
        .from("wa_connections")
        .update({ daily_unique_sent: 0, daily_sent_reset_at: now.toISOString() })
        .eq("user_id", userId);
      dailyUsed = 0;
    }

    let sentCount = 0;
    let failedCount = 0;

    // Determine if this is a MARKETING template (US ban applies since April 1, 2025)
    const isMarketingTemplate =
      (template.category ?? "").toUpperCase() === "MARKETING";

    for (const recipient of recipientsToSend) {
      const phone = phoneMap[recipient.contact_id]?.replace(/\D/g, "");
      if (!phone) {
        await supabase
          .from("wa_broadcast_recipients")
          .update({ status: "failed", error: "No phone number" })
          .eq("id", recipient.id);
        failedCount++;
        continue;
      }

      // US marketing ban: Meta error 63049. Marketing templates to US numbers
      // (+1 country code) fail since April 1, 2025. Skip upfront to avoid wasting sends.
      const isUSNumber = phone.startsWith("1") && phone.length === 11;
      if (isMarketingTemplate && isUSNumber) {
        await supabase
          .from("wa_broadcast_recipients")
          .update({
            status: "skipped",
            error: "US marketing ban: Meta does not allow marketing templates to +1 numbers (effective April 1, 2025, error 63049)",
          })
          .eq("id", recipient.id);
        failedCount++;
        continue;
      }

      try {
        // Fill each {{n}} from the plan the user chose when creating the broadcast.
        // resolveBodyParameters never returns an empty value, which Meta rejects.
        const paramValues = resolveBodyParameters(template.body_text || "", broadcast.variables, {
          name: nameMap[recipient.contact_id] === phone ? null : nameMap[recipient.contact_id],
          phone,
        });
        const components =
          paramValues.length > 0
            ? [{ type: "body", parameters: paramValues.map(v => ({ type: "text", text: v })) }]
            : undefined;

        const result = await sendTemplateMessage(
          conn.phone_number_id,
          phone,
          template.name,
          template.language || "en_US",
          validToken,
          components
        );

        await supabase
          .from("wa_broadcast_recipients")
          .update({
            status: "sent",
            wa_message_id: result.messages?.[0]?.id,
            sent_at: new Date().toISOString(),
          })
          .eq("id", recipient.id);

        sentCount++;
        dailyUsed++;

        // Throttle: wait between sends to avoid API rate-limit errors
        await sleep(SEND_DELAY_MS);
      } catch (err: any) {
        const metaErr = err?.metaError;
        let errorText = err.message?.slice(0, 200) ?? "Unknown error";

        if (metaErr) {
          errorText = `(#${metaErr.code}) ${metaErr.message}`;

          // Token expired mid-broadcast — mark connection and stop
          if (metaErr.isTokenExpired) {
            await supabase
              .from("wa_connections")
              .update({ status: "expired", last_error: errorText, last_error_at: new Date().toISOString() })
              .eq("user_id", userId);
            await supabase
              .from("wa_broadcast_recipients")
              .update({ status: "failed", error: "Token expired — reconnect WhatsApp" })
              .eq("id", recipient.id);
            failedCount++;
            break;
          }

          // Meta cannot charge the business (error 131042): stop and explain the fix.
          if (metaErr.code === 131042) {
            await supabase
              .from("wa_broadcast_recipients")
              .update({ status: "failed", error: "Meta payment issue: add a payment method in Meta Business Manager" })
              .eq("id", recipient.id);
            failedCount++;
            break;
          }

          // Rate-limit hit — stop and let user retry later
          if (metaErr.isRateLimit) {
            await supabase
              .from("wa_broadcast_recipients")
              .update({ status: "failed", error: "Rate limit — retry later" })
              .eq("id", recipient.id);
            failedCount++;
            break;
          }

          // Unreachable number — log and continue (don't count against quality)
          if (metaErr.isUnreachable) {
            await supabase
              .from("wa_broadcast_recipients")
              .update({ status: "failed", error: errorText })
              .eq("id", recipient.id);
            failedCount++;
            await sleep(SEND_DELAY_MS);
            continue;
          }
        }

        await supabase
          .from("wa_broadcast_recipients")
          .update({ status: "failed", error: errorText })
          .eq("id", recipient.id);
        failedCount++;
        await sleep(SEND_DELAY_MS);
      }
    }

    // Update daily counter
    await supabase
      .from("wa_connections")
      .update({ daily_unique_sent: dailyUsed })
      .eq("user_id", userId);

    await supabase
      .from("wa_broadcasts")
      .update({
        status: "completed",
        sent_count: sentCount,
        failed_count: failedCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", broadcastId);

    return json({
      success: true,
      sent: sentCount,
      failed: failedCount,
      skipped_opt_out: skippedOptOut,
      skipped_tier_limit: skippedByLimit,
    });
  } catch (error: any) {
    console.error("Broadcast send error:", error);
    return json({ error: error.message }, { status: 500 });
  }
}
