import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api/auth";
import { sendApiMessage } from "@/lib/api/send";
import { respond } from "@/lib/api/http";

/**
 * Send one WhatsApp message.
 *   Text (customer wrote in the last 24h):  { phone, type: "text", text }
 *   Template:                               { phone, template, params?: [..], language? }
 *   Verification code:                      { phone, type: "otp", otp: "482913" }
 */
export async function POST(req: Request) {
  try {
    const auth = await authenticateApiKey(req);
    if (!auth.ok) return auth.response;
    const body = await req.json().catch(() => null);
    if (!body?.phone) return NextResponse.json({ error: "Missing required field: phone" }, { status: 400 });
    return respond(await sendApiMessage(auth.supabase, auth.userId, body), (r) => ({ success: true, message_id: r.message_id }));
  } catch (err) {
    console.error("v1/send error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
