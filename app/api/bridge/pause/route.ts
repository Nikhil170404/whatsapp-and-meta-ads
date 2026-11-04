import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { authenticateBridge } from "@/lib/bridge/auth";
import { normalizePhone, phoneVariants } from "@/lib/whatsapp/phone";
import { parsePause } from "@/lib/bridge/pause";

/**
 * Called by ReplyKaro Unified (.com) when a person takes over a chat or hands it back.
 * Body: { wa_id, paused, until? }. While paused, automations, flows and AI replies skip that person.
 */
export async function POST(req: Request) {
  const db = getSupabaseAdmin() as any;
  const auth = await authenticateBridge(db, req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = parsePause(auth.body);
  if (!parsed) return NextResponse.json({ error: "wa_id and paused are required" }, { status: 400 });
  const digits = normalizePhone(parsed.waId);
  const variants = digits ? phoneVariants(digits) : [parsed.waId]; // business-scoped ids are stored as they come

  // Create the contact if it does not exist yet, so a pause set before their next message still holds.
  await db.from("wa_contacts").upsert({ user_id: auth.userId, phone_number: variants[0] }, { onConflict: "user_id,phone_number", ignoreDuplicates: true });
  const { error } = await db.from("wa_contacts").update({ automation_paused_until: parsed.until }).eq("user_id", auth.userId).in("phone_number", variants);
  if (error) return NextResponse.json({ error: "Could not save the pause" }, { status: 500 });
  return NextResponse.json({ ok: true, paused: parsed.until !== null, until: parsed.until });
}
