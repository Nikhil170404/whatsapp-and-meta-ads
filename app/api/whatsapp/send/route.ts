import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { checkRateLimit } from "@/lib/rate-limit-middleware";
import { sendApiMessage } from "@/lib/api/send";

/**
 * Dashboard send. Free text only while the customer's 24-hour window is open,
 * otherwise an approved template: { to, template, params? }. All guards (opt-out,
 * window, template approval, quality) live in sendApiMessage.
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkRateLimit("api", `user:${session.id}`);
    if (!rl.success) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });

    const { to, message, template, params, language } = await req.json();
    if (!to || (!message?.trim() && !template)) {
      return NextResponse.json({ error: "Choose who to message and write a message or pick a template." }, { status: 400 });
    }
    if (message && message.trim().length > 4096) {
      return NextResponse.json({ error: "Message too long. The limit is 4,096 characters." }, { status: 400 });
    }

    const result = await sendApiMessage(getSupabaseAdmin() as any, session.id, template
      ? { phone: to, type: "template", template, params, language }
      : { phone: to, type: "text", text: message.trim() });

    if (!result.ok) {
      return NextResponse.json({ error: result.error, ...(result.code ? { code: result.code } : {}) }, { status: result.status });
    }
    return NextResponse.json({ success: true, message_id: result.data.message_id, message: { id: result.data.message_id } });
  } catch (error: any) {
    console.error("Send message error:", error);
    return NextResponse.json({ error: error.message || "Failed to send message" }, { status: 500 });
  }
}
