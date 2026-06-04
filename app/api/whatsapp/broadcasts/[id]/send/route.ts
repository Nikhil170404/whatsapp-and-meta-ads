import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { sendTemplateMessage } from "@/lib/whatsapp/service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: broadcastId } = await params;
    const supabase = getSupabaseAdmin() as any;

    const { data: broadcast } = await supabase
      .from("wa_broadcasts")
      .select("*")
      .eq("id", broadcastId)
      .eq("user_id", session.id)
      .single();

    if (!broadcast) return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });
    if (broadcast.status === "sending" || broadcast.status === "completed") {
      return NextResponse.json({ error: "Broadcast already sent" }, { status: 400 });
    }

    const { data: conn } = await supabase
      .from("wa_connections")
      .select("phone_number_id, access_token, billing_type, waba_id")
      .eq("user_id", session.id)
      .single();

    if (!conn) return NextResponse.json({ error: "WhatsApp not connected" }, { status: 400 });

    const { data: template } = await supabase
      .from("wa_templates")
      .select("name, language, status")
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
        .eq("user_id", session.id)
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
      .select("id, phone_number")
      .in("id", contactIds);

    const phoneMap: Record<string, string> = {};
    (contacts || []).forEach((c: any) => { phoneMap[c.id] = c.phone_number; });

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
        const result = await sendTemplateMessage(
          conn.phone_number_id,
          phone,
          template.name,
          template.language || "en_US",
          conn.access_token
        );

        await supabase
          .from("wa_broadcast_recipients")
          .update({ status: "sent", wa_message_id: result.messages?.[0]?.id, sent_at: new Date().toISOString() })
          .eq("id", recipient.id);
        sentCount++;

        // Deduct wallet for managed billing
        if (conn.billing_type === "managed") {
          const { data: wallet } = await supabase
            .from("wa_wallet")
            .select("balance_paise, total_spent_paise")
            .eq("user_id", session.id)
            .single();
          if (wallet) {
            await supabase
              .from("wa_wallet")
              .update({
                balance_paise: wallet.balance_paise - 95,
                total_spent_paise: wallet.total_spent_paise + 95,
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", session.id);
            await supabase.from("wa_wallet_transactions").insert({
              user_id: session.id,
              type: "debit",
              amount_paise: 95,
              balance_after_paise: wallet.balance_paise - 95,
              description: `Broadcast: ${broadcast.name} → ${phone}`,
            });
          }
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
