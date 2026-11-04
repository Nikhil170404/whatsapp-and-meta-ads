import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { authenticateBridge } from "@/lib/bridge/auth";
import { sendApiMessage } from "@/lib/api/send";

/**
 * Called by ReplyKaro Unified (.com) when a person replies from the shared inbox.
 * Body: { wa_id, text, dedupe_key, sent_by }. Free text only inside the 24-hour window.
 * Answers 200 when accepted; a repeat of the same dedupe_key answers 200 without sending again.
 */
export async function POST(req: Request) {
  const db = getSupabaseAdmin() as any;
  const auth = await authenticateBridge(db, req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { wa_id, text, dedupe_key } = auth.body;
  if (typeof wa_id !== "string" || typeof text !== "string" || !text.trim() || text.length > 4096 || typeof dedupe_key !== "string" || !dedupe_key || dedupe_key.length > 200) {
    return NextResponse.json({ error: "wa_id, text and dedupe_key are required" }, { status: 400 });
  }

  // Idempotency: remember the key before sending so a retry never sends twice.
  const key = `send:${auth.userId}:${dedupe_key}`;
  const { error: dupe } = await db.from("bridge_outbox").insert({
    user_id: auth.userId, event_type: "message.outbound", dedupe_key: key, payload: { type: "bridge.send", dedupe_key }, delivered_at: new Date().toISOString(),
  });
  if (dupe) {
    if (dupe.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
    return NextResponse.json({ error: "Could not record the request" }, { status: 500 });
  }

  const result = await sendApiMessage(db, auth.userId, { phone: wa_id, type: "text", text: text.trim() }, { origin: "bridge" });
  if (!result.ok) {
    await db.from("bridge_outbox").delete().eq("user_id", auth.userId).eq("dedupe_key", key); // let .com retry after fixing the cause
    return NextResponse.json({ error: result.error, ...(result.code ? { code: result.code } : {}) }, { status: result.status });
  }
  return NextResponse.json({ ok: true, message_id: result.data.message_id });
}
