import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sendTextMessage } from "@/lib/whatsapp/service";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { to, message } = await req.json();
    if (!to || !message?.trim()) {
      return NextResponse.json({ error: "Phone number and message are required" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
    );

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
      const { data: wallet, error: walletErr } = await supabase
        .from("wa_wallet")
        .select("balance_paise, total_spent_paise")
        .eq("user_id", session.id)
        .single();

      if (walletErr || !wallet) {
        console.error("Send message wallet fetch error:", walletErr);
        return NextResponse.json({ error: "Wallet not found. Please set up managed billing." }, { status: 400 });
      }

      if (wallet.balance_paise < 95) {
        return NextResponse.json(
          {
            error: "Insufficient wallet balance. Top up your ReplyKaro wallet to continue sending messages.",
            code: "INSUFFICIENT_BALANCE",
          },
          { status: 402 }
        );
      }

      const result = await sendTextMessage(
        connection.phone_number_id,
        to,
        message.trim(),
        connection.access_token
      );

      const msgId = result?.messages?.[0]?.id ?? `local_${Date.now()}`;
      const { data: savedMsg } = await supabase
        .from("wa_messages")
        .insert({
          user_id: session.id,
          message_id: msgId,
          direction: "outbound",
          from_phone: null,
          to_phone: to,
          content: message.trim(),
          status: "sent",
        })
        .select()
        .single();

      const newBalance = wallet.balance_paise - 95;
      const newTotalSpent = wallet.total_spent_paise + 95;

      const { error: debitErr } = await supabase
        .from("wa_wallet")
        .update({
          balance_paise: newBalance,
          total_spent_paise: newTotalSpent,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", session.id);

      if (debitErr) {
        console.error("Send message wallet debit error:", debitErr);
      }

      const { error: txnErr } = await supabase.from("wa_wallet_transactions").insert({
        user_id: session.id,
        type: "debit",
        amount_paise: 95,
        balance_after_paise: newBalance,
        description: `Message to ${to}`,
      });

      if (txnErr) {
        console.error("Send message wallet transaction log error:", txnErr);
      }

      return NextResponse.json({ success: true, message: savedMsg });
    }

    const result = await sendTextMessage(
      connection.phone_number_id,
      to,
      message.trim(),
      connection.access_token
    );

    const msgId = result?.messages?.[0]?.id ?? `local_${Date.now()}`;
    const { data: savedMsg } = await supabase
      .from("wa_messages")
      .insert({
        user_id: session.id,
        message_id: msgId,
        direction: "outbound",
        from_phone: null,
        to_phone: to,
        content: message.trim(),
        status: "sent",
      })
      .select()
      .single();

    return NextResponse.json({ success: true, message: savedMsg });
  } catch (error: any) {
    console.error("Send message error:", error);
    return NextResponse.json({ error: error.message || "Failed to send message" }, { status: 500 });
  }
}
