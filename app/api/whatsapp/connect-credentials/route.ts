import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { checkRateLimit } from "@/lib/rate-limit-middleware";
import { connectWithCredentials, isAdminEmail, serverCredentials } from "@/lib/whatsapp/connect-credentials";

/**
 * Connect a WhatsApp number from a WABA ID and token (Meta test accounts, System User tokens).
 * Body: { waba_id, access_token, phone_number_id? }  or  { use_server_credentials: true }.
 * The server's own credentials (WHATSAPP_* variables) can only be used by ADMIN_EMAILS, so a
 * visitor can never attach the platform owner's account to theirs.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Brute-forcing tokens through this form must not be possible.
  const rl = await checkRateLimit("auth", `connect-credentials:${session.id}`);
  if (!rl.success) return NextResponse.json({ error: "Too many attempts. Wait a few minutes and try again." }, { status: 429 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });

  const db = getSupabaseAdmin() as any;
  let creds;
  if (body.use_server_credentials === true) {
    const { data: user } = await db.from("users").select("email").eq("id", session.id).maybeSingle();
    if (!isAdminEmail(user?.email)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    creds = serverCredentials();
    if (!creds) return NextResponse.json({ error: "The server has no WHATSAPP_ACCESS_TOKEN and WHATSAPP_BUSINESS_ACCOUNT_ID set." }, { status: 400 });
  } else {
    creds = { wabaId: String(body.waba_id ?? ""), token: String(body.access_token ?? ""), phoneNumberId: body.phone_number_id ? String(body.phone_number_id) : undefined };
  }

  const result = await connectWithCredentials(db, session.id, creds, {
    appId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID, appSecret: process.env.FACEBOOK_APP_SECRET,
  });
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json({ success: true, summary: result.data });
}
