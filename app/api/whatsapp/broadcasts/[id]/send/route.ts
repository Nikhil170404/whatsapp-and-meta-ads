import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { sendTemplateMessage, sleep, UNREACHABLE_CODES } from "@/lib/whatsapp/service";
import { refreshWaTokenIfNeeded } from "@/lib/whatsapp/token";
import { checkRateLimit } from "@/lib/rate-limit-middleware";

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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    // Internal cron calls may act on behalf of a user only when they present CRON_SECRET.
    let cronUserId: string | null = null;
    const cronAuth = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && cronAuth === `Bearer ${cronSecret}`) {
      cronUserId = req.headers.get("x-cron-user-id");
    }

    const userId = session?.id || cronUserId;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: broadcastId } = await params;

    const rl = await checkRateLimit("api", `broadcast:${broadcastId}`);
    if (!rl.success) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

    const supabase = getSupabaseAdmin() as any;

    const { data: broadcast } = await supabase
      .from("wa_broadcasts")
      .select("*")
      .eq("id", broadcastId)
      .eq("user_id", userId)
      .single();

    if (!broadcast) return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });
    if (broadcast.status === "sending" || broadcast.status === "completed") {
      return NextResponse.json({ error: "Broadcast already sent" }, { status: 400 });
    }

    const { data: conn } = await supabase
      .from("wa_connections")
      .select("phone_number_id, access_token, token_expires_at, billing_type, waba_id, quality_rating, messaging_tier, quality_paused_at, daily_unique_sent, daily_sent_reset_at")
      .eq("user_id", userId)
      .single();

    if (!conn) return NextResponse.json({ error: "WhatsApp not connected" }, { status: 400 });

    // ── Quality gate: block broadcasts when quality is LOW ──────────────────
    if (conn.quality_paused_at || conn.quality_rating === "LOW") {
      return NextResponse.json({
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
      .select("name, language, status, body_text")
      .eq("id", broadcast.template_id)
      .single();

    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    // ── Template must be approved — never send an unapproved template ───────
    if (template.status !== "approved") {
      return NextResponse.json({
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
      return NextResponse.json({ error: "No pending recipients" }, { status: 400 });
    }

    // Fetch contacts — only opted-in, valid phone numbers
    const contactIds = recipients.map((r: any) => r.contact_id);
    const { data: contacts } = await supabase
      .from("wa_contacts")
      .select("id, phone_number, display_name, is_opted_in")
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
      return NextResponse.json({
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

    // ── Wallet check for managed billing ────────────────────────────────────
    if (conn.billing_type === "managed") {
      const needed = recipientsToSend.length * 95;
      const { data: wallet } = await supabase
        .from("wa_wallet")
        .select("balance_paise")
        .eq("user_id", userId)
        .single();
      if ((wallet?.balance_paise || 0) < needed) {
        const neededRs = (needed / 100).toFixed(2);
        const haveRs = ((wallet?.balance_paise || 0) / 100).toFixed(2);
        return NextResponse.json({
          error: `Insufficient wallet balance. Need ₹${neededRs} for ${recipientsToSend.length} recipients but only have ₹${haveRs}.`,
          code: "INSUFFICIENT_BALANCE",
        }, { status: 402 });
      }
    }

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

      try {
        // Build template component parameters from numbered placeholders ({{1}}, {{2}}, …)
        const contactName = nameMap[recipient.contact_id] || phone;
        const numberedParams = (template.body_text || "").match(/\{\{\d+\}\}/g) || [];
        const paramValues: string[] = [
          contactName,
          phone,
          ...Array(Math.max(0, numberedParams.length - 2)).fill(""),
        ];
        const components =
          numberedParams.length > 0
            ? [
                {
                  type: "body",
                  parameters: paramValues
                    .slice(0, numberedParams.length)
                    .map(v => ({ type: "text", text: v })),
                },
              ]
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

        // Atomically deduct wallet — stops if balance runs out mid-broadcast
        if (conn.billing_type === "managed") {
          const { data: newBal, error: deductErr } = await supabase.rpc(
            "deduct_wallet_balance",
            { p_user_id: userId, p_amount: 95 }
          );
          if (deductErr) {
            await supabase
              .from("wa_broadcast_recipients")
              .update({ status: "failed", error: "Wallet empty" })
              .eq("id", recipient.id);
            failedCount++;
            sentCount--;
            break;
          }
          await supabase.from("wa_wallet_transactions").insert({
            user_id: userId,
            type: "debit",
            amount_paise: 95,
            balance_after_paise: newBal,
            description: `Broadcast: ${broadcast.name} → ${phone}`,
          });
        }

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

    return NextResponse.json({
      success: true,
      sent: sentCount,
      failed: failedCount,
      skipped_opt_out: skippedOptOut,
      skipped_tier_limit: skippedByLimit,
    });
  } catch (error: any) {
    console.error("Broadcast send error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
