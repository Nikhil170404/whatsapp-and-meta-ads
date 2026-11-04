import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { encryptSecret } from "@/lib/crypto/secrets";
import { isSafeComUrl } from "@/lib/bridge/signing";
import { isValidCode, trustedOrigin } from "@/lib/bridge/connect";

/**
 * Finishes the link. Takes the single-use code from replykaro.com, claims the Link ID and secret from there
 * (server to server), and saves them. Nobody sees or pastes the secret.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const b = await req.json().catch(() => null);
  const origin = trustedOrigin(b?.from);
  if (!isValidCode(b?.code) || !origin) return NextResponse.json({ error: "This connect link is not valid. Start again from ReplyKaro Unified." }, { status: 400 });

  let claimed: any;
  try {
    const res = await fetch(`${origin}/api/unified/whatsapp/claim`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: b.code }), signal: AbortSignal.timeout(10_000),
    });
    claimed = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ error: claimed?.error || "ReplyKaro Unified did not accept the code. Start again from there." }, { status: res.status === 410 ? 410 : 502 });
  } catch {
    return NextResponse.json({ error: "Could not reach ReplyKaro Unified. Try again in a minute." }, { status: 502 });
  }

  const { linkId, secret, webhookUrl } = claimed ?? {};
  if (typeof linkId !== "string" || typeof secret !== "string" || secret.length < 16 || !isSafeComUrl(String(webhookUrl)) || new URL(webhookUrl).origin !== origin) {
    return NextResponse.json({ error: "ReplyKaro Unified sent an unexpected answer." }, { status: 502 });
  }
  const db = getSupabaseAdmin() as any;
  const { error } = await db.from("bridge_links").upsert(
    { user_id: session.id, link_id: linkId, com_url: webhookUrl, signing_secret: encryptSecret(secret), status: "active", last_error: null, linked_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (error) return NextResponse.json({ error: error.code === "42P01" ? "Run supabase/unified-bridge.sql first." : "Could not save the link." }, { status: 500 });

  const { data: conn } = await db.from("wa_connections").select("status").eq("user_id", session.id).maybeSingle();
  return NextResponse.json({ ok: true, numberConnected: conn?.status === "active" });
}
