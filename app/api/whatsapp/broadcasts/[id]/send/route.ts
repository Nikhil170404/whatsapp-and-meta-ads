import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { sendTemplateMessage } from "@/lib/whatsapp/service";
import { checkRateLimit } from "@/lib/rate-limit-middleware";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();

    // Internal cron calls may act on behalf of a user, but ONLY when they
    // present the shared CRON_SECRET. Without it, the x-cron-user-id header is
    // ignored so it can't be used to trigger another user's paid broadcasts.
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
      .select("phone_number_id, access_token, billing_type, waba_id")
      .eq("user_id", userId)
      .single();

    if (!conn) return NextResponse.json({ error: "WhatsApp not connected" }, { status: 400 });

    const { data: template } = await supabase
      .from("wa_templates")
      .select("name, language, status, body_text")
      .eq("id", broadcast.template_id)
      .single();

    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    // Get all pending recipients
    const { data: recipients } = await supabase
      .from("wa_broadcast_recipients")
      .select("id, contact_id")
      .eq("broadcast_id", broadcastId)
      .eq("status", "pending");

    if (!recipients?.length) {
      return NextResponse.json({ error: "No pending recipients" }, { status: 400 });
    }

    // Check wallet for managed billing
    if (conn.billing_type === "managed") {
      const needed = recipients.length * 95;
      const { data: wallet } = await supabase
        .from("wa_wallet")
        .select("balance_paise")
        .eq("user_id", userId)
        .single();
      if ((wallet?.balance_paise || 0) < needed) {
        const neededRs = (needed / 100).toFixed(2);
        const haveRs = ((wallet?.balance_paise || 0) / 100).toFixed(2);
        return NextResponse.json({
          error: `Insufficient wallet balance. Need ₹${neededRs} for ${recipients.length} recipients but only have ₹${haveRs}.`,
          code: "INSUFFICIENT_BALANCE",
        }, { status: 402 });
      }
    }

    // Fetch contact phone numbers
    const contactIds = recipients.map((r: any) => r.contact_id);
    const { data: contacts } = await supabase
      .from("wa_contacts")
      .select("id, phone_number, display_name")
      .eq("user_id", userId)
      .in("id", contactIds);

    const phoneMap: Record<string, string> = {};
    const nameMap: Record<string, string> = {};
    (contacts || []).forEach((c: any) => {
      phoneMap[c.id] = c.phone_number;
      nameMap[c.id] = c.display_name || c.phone_number;
    });

    // Mark as sending
    await supabase
      .from("wa_broadcasts")
      .update({ status: "sending", updated_at: new Date().toISOString() })
      .eq("id", broadcastId);

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
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
        // Broadcasts must always use approved templates (Meta 24-hour window policy).
        // Build component parameters from numbered placeholders ({{1}}, {{2}}, ...).
        const contactName = nameMap[recipient.contact_id] || phone;
        const numberedParams = (template.body_text || "").match(/\{\{\d+\}\}/g) || [];
        const paramValues: string[] = [contactName, phone, ...Array(Math.max(0, numberedParams.length - 2)).fill("")];
        const components = numberedParams.length > 0 ? [{
          type: "body",
          parameters: paramValues.slice(0, numberedParams.length).map(v => ({ type: "text", text: v })),
        }] : undefined;

        const result = await sendTemplateMessage(
          conn.phone_number_id,
          phone,
          template.name,
          template.language || "en_US",
          conn.access_token,
          components
        );

        await supabase
          .from("wa_broadcast_recipients")
          .update({ status: "sent", wa_message_id: result.messages?.[0]?.id, sent_at: new Date().toISOString() })
          .eq("id", recipient.id);
        sentCount++;

        // Atomically deduct wallet — stops if balance runs out mid-broadcast
        if (conn.billing_type === "managed") {
          const { data: newBal, error: deductErr } = await supabase.rpc("deduct_wallet_balance", {
            p_user_id: userId,
            p_amount: 95,
          });
          if (deductErr) {
            // Wallet ran out mid-broadcast — stop sending
            await supabase.from("wa_broadcast_recipients").update({ status: "failed", error: "Wallet empty" }).eq("id", recipient.id);
            failedCount++;
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
      } catch (err: any) {
        await supabase
          .from("wa_broadcast_recipients")
          .update({ status: "failed", error: err.message?.slice(0, 200) })
          .eq("id", recipient.id);
        failedCount++;
      }
    }

    await supabase
      .from("wa_broadcasts")
      .update({
        status: "completed",
        sent_count: sentCount,
        failed_count: failedCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", broadcastId);

    return NextResponse.json({ success: true, sent: sentCount, failed: failedCount });
  } catch (error: any) {
    console.error("Broadcast send error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
