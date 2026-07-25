import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { sendTextMessage } from "@/lib/whatsapp/service";
import { checkRateLimit } from "@/lib/rate-limit-middleware";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkRateLimit("api", `user:${session.id}`);
    if (!rl.success) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });

    const { to, message } = await req.json();
    if (!to || !message?.trim()) {
      return NextResponse.json({ error: "Phone number and message are required" }, { status: 400 });
    }
    if (message.trim().length > 4096) {
      return NextResponse.json({ error: "Message too long — maximum 4,096 characters (Meta limit)" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin() as any;

    // Block opted-out contacts before touching the WA API
    const { data: contactRow } = await supabase
      .from("wa_contacts")
      .select("is_opted_in")
      .eq("user_id", session.id)
      .eq("phone_number", to)
      .maybeSingle();
    if (contactRow?.is_opted_in === false) {
      return NextResponse.json({
        error: "This contact has opted out. They must text START to re-subscribe before you can message them.",
        code: "OPTED_OUT",
      }, { status: 403 });
    }

    const { data: connection, error: connErr } = await supabase
      .from("wa_connections")
      .select("phone_number_id, access_token, status, billing_type")
      .eq("user_id", session.id)
      .single();

    if (connErr || !connection) {
      return NextResponse.json({ error: "WhatsApp not connected. Connect your account first." }, { status: 400 });
    }
    if (connection.status !== "active") {
      return NextResponse.json({ error: "WhatsApp connection is not active. Please reconnect." }, { status: 400 });
    }

    if (connection.billing_type === "managed") {
      // Atomically deduct BEFORE sending — prevents race conditions
      const { data: newBalance, error: deductErr } = await supabase.rpc("deduct_wallet_balance", {
        p_user_id: session.id,
        p_amount: 95,
      });

      if (deductErr) {
        const msg = deductErr.message || "";
        if (msg.includes("INSUFFICIENT_BALANCE") || msg.includes("WALLET_NOT_FOUND")) {
          return NextResponse.json({
            error: "Insufficient wallet balance. Top up your ReplyKaro wallet to continue sending messages.",
            code: "INSUFFICIENT_BALANCE",
          }, { status: 402 });
        }
        return NextResponse.json({ error: "Wallet error. Please try again." }, { status: 500 });
      }

      try {
        const result = await sendTextMessage(
          connection.phone_number_id,
          to,
          message.trim(),
          connection.access_token
        );

        const msgId = result?.messages?.[0]?.id ?? `local_${Date.now()}`;

        await Promise.all([
          supabase.from("wa_messages").insert({
            user_id: session.id,
            message_id: msgId,
            direction: "outbound",
            from_phone: null,
            to_phone: to,
            content: message.trim(),
            status: "sent",
          }),
          supabase.from("wa_wallet_transactions").insert({
            user_id: session.id,
            type: "debit",
            amount_paise: 95,
            balance_after_paise: newBalance,
            description: `Message to ${to}`,
          }),
        ]);

        return NextResponse.json({ success: true, message_id: msgId });
      } catch (sendErr: any) {
        // Refund the deduction once if the send failed.
        const { data: w } = await supabase.from("wa_wallet").select("balance_paise, total_spent_paise").eq("user_id", session.id).single();
        if (w) {
          await supabase.from("wa_wallet").update({
            balance_paise: (w.balance_paise as number) + 95,
            total_spent_paise: Math.max(0, (w.total_spent_paise as number) - 95),
            updated_at: new Date().toISOString(),
          }).eq("user_id", session.id);
        }
        throw sendErr;
      }
    }

    // Direct billing — no wallet check
    const result = await sendTextMessage(
      connection.phone_number_id,
      to,
      message.trim(),
      connection.access_token
    );

    const msgId = result?.messages?.[0]?.id ?? `local_${Date.now()}`;
    await supabase.from("wa_messages").insert({
      user_id: session.id,
      message_id: msgId,
      direction: "outbound",
      from_phone: null,
      to_phone: to,
      content: message.trim(),
      status: "sent",
    });

    return NextResponse.json({ success: true, message_id: msgId });
  } catch (error: any) {
    console.error("Send message error:", error);
    return NextResponse.json({ error: error.message || "Failed to send message" }, { status: 500 });
  }
}
