import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { NextResponse } from "next/server";
import { resolveWabaFromToken } from "@/lib/whatsapp/waba-lookup";

const WA_API_URL = "https://graph.facebook.com/v25.0";

/**
 * Reports exactly what Meta says about the stored token: which Facebook identity it
 * belongs to, which permissions were granted, and which WhatsApp assets (if any) are
 * attached. Read-only — never writes. Used by the Connect page to explain failures
 * instead of showing a generic error.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin() as any;
  const { data: userRow } = await supabase
    .from("users")
    .select("fb_access_token, display_name, facebook_user_id")
    .eq("id", session.id)
    .single();

  const token = userRow?.fb_access_token;
  if (!token) {
    return NextResponse.json({ ok: false, checks: [{ name: "Stored token", status: "fail", detail: "No Facebook token stored. Sign in again." }] });
  }

  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.json({ ok: false, checks: [{ name: "Server config", status: "fail", detail: "App ID or secret missing." }] });
  }

  const checks: Array<{ name: string; status: "pass" | "fail" | "warn"; detail: string }> = [];

  // Who does this token belong to, and is it still valid?
  try {
    const res = await fetch(`${WA_API_URL}/me?fields=id,name&access_token=${token}`);
    const json = await res.json();
    if (json?.error) checks.push({ name: "Token valid", status: "fail", detail: json.error.message });
    else checks.push({ name: "Token valid", status: "pass", detail: `Facebook account: ${json.name} (${json.id})` });
  } catch {
    checks.push({ name: "Token valid", status: "fail", detail: "Could not reach Meta Graph API." });
  }

  // Which permissions did the user actually grant?
  try {
    const res = await fetch(`${WA_API_URL}/me/permissions?access_token=${token}`);
    const json = await res.json();
    const granted = (json?.data || []).filter((p: any) => p.status === "granted").map((p: any) => p.permission);
    const hasWaMgmt = granted.includes("whatsapp_business_management");
    checks.push({
      name: "WhatsApp permissions",
      status: hasWaMgmt ? "pass" : "fail",
      detail: hasWaMgmt
        ? `Granted: ${granted.join(", ")}`
        : `whatsapp_business_management was NOT granted. Granted: ${granted.join(", ") || "none"}. Your Login Configuration must be the "WhatsApp Embedded Signup" type.`,
    });
  } catch {
    checks.push({ name: "WhatsApp permissions", status: "fail", detail: "Could not read permissions." });
  }

  // Which WhatsApp assets are attached to the token?
  const { wabaId, phoneNumberId, diagnostics } = await resolveWabaFromToken(token, appId, appSecret);
  checks.push({
    name: "WhatsApp Business Account",
    status: wabaId ? "pass" : "fail",
    detail: wabaId ? `WABA ID ${wabaId}` : diagnostics.join(" | ") || "No WABA attached to this token.",
  });
  checks.push({
    name: "Phone number",
    status: phoneNumberId ? "pass" : "warn",
    detail: phoneNumberId
      ? `Phone number ID ${phoneNumberId}`
      : "No phone number registered. Add and verify a number in the WhatsApp signup flow.",
  });

  return NextResponse.json({ ok: Boolean(wabaId && phoneNumberId), checks });
}
