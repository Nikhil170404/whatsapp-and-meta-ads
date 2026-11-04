import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { encryptSecret } from "@/lib/crypto/secrets";
import { isSafeComUrl } from "@/lib/bridge/signing";

/** Link status for the signed-in person. The secret is never returned. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await (getSupabaseAdmin() as any).from("bridge_links").select("link_id, com_url, status, linked_at, last_push_at, last_error").eq("user_id", session.id).maybeSingle();
  const { count } = await (getSupabaseAdmin() as any).from("bridge_outbox").select("id", { count: "exact", head: true }).eq("user_id", session.id).is("delivered_at", null);
  return NextResponse.json({ link: data ?? null, waiting: count ?? 0 });
}

/** Save the three values shown in Unified > Channels on .com: address, Link ID and secret. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  const address = typeof b?.address === "string" ? b.address.trim() : "";
  const linkId = typeof b?.linkId === "string" ? b.linkId.trim() : "";
  const secret = typeof b?.secret === "string" ? b.secret.trim() : "";
  if (!isSafeComUrl(address)) return NextResponse.json({ error: "The address must start with https://" }, { status: 400 });
  if (!linkId || linkId.length > 100 || !secret || secret.length < 16 || secret.length > 200) return NextResponse.json({ error: "Link ID and secret are required" }, { status: 400 });
  const { error } = await (getSupabaseAdmin() as any).from("bridge_links").upsert(
    { user_id: session.id, link_id: linkId, com_url: address, signing_secret: encryptSecret(secret), status: "active", last_error: null, linked_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (error) return NextResponse.json({ error: error.code === "23505" ? "That Link ID is already used by another account" : "Could not save the link. Run supabase/unified-bridge.sql first." }, { status: error.code === "23505" ? 409 : 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await (getSupabaseAdmin() as any).from("bridge_links").update({ status: "revoked" }).eq("user_id", session.id);
  return NextResponse.json({ ok: true });
}
