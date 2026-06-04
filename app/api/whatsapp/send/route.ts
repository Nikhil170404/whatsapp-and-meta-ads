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

    // Get user's WhatsApp connection
    const { data: connection, error: connErr } = await supabase
      .from("wa_connections")
      .select("phone_number_id, access_token, status")
      .eq("user_id", session.id)
      .single();

    if (connErr || !connection) {
      return NextResponse.json({ error: "WhatsApp not connected. Connect your account first." }, { status: 400 });
    }
    if (connection.status !== "active") {
      return NextResponse.json({ error: "WhatsApp connection is not active. Please reconnect." }, { status: 400 });
    }

    // Send via WhatsApp API
    const result = await sendTextMessage(
      connection.phone_number_id,
      to,
      message.trim(),
      connection.access_token
    );

    // Save to wa_messages table
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
