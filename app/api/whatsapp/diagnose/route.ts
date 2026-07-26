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

  // Is this app subscribed to the WABA's webhooks? Without this Meta never
  // delivers inbound messages, so no automation can ever fire.
  if (wabaId) {
    try {
      const res = await fetch(`${WA_API_URL}/${wabaId}/subscribed_apps?access_token=${token}`);
      const json = await res.json();
      const apps = json?.data || [];
      const subscribed = apps.some((a: any) => String(a?.whatsapp_business_api_data?.id) === String(appId));
      checks.push({
        name: "Webhook subscription",
        status: subscribed ? "pass" : "fail",
        detail: subscribed
          ? "This app is subscribed to the WABA's webhooks."
          : `App ${appId} is NOT subscribed to WABA ${wabaId}. Reconnect to subscribe, and make sure the Webhooks callback URL is configured in the Meta App dashboard.`,
      });
    } catch {
      checks.push({ name: "Webhook subscription", status: "warn", detail: "Could not read subscribed_apps." });
    }
  }

  // Is the number actually in a state that can send? A phone that is PENDING or
  // RESTRICTED, or a WABA still under review, blocks delivery regardless of code.
  if (phoneNumberId) {
    try {
      const res = await fetch(
        `${WA_API_URL}/${phoneNumberId}?fields=status,code_verification_status,quality_rating,name_status&access_token=${token}`
      );
      const json = await res.json();
      if (json?.error) {
        checks.push({ name: "Number status", status: "warn", detail: json.error.message });
      } else {
        const ready = json.status === "CONNECTED";
        checks.push({
          name: "Number status",
          status: ready ? "pass" : "fail",
          detail: ready
            ? `CONNECTED · quality ${json.quality_rating ?? "unknown"} · name ${json.name_status ?? "unknown"}`
            : `Meta reports status ${json.status ?? "unknown"} — the number cannot send until this is CONNECTED.`,
        });
      }
    } catch {
      checks.push({ name: "Number status", status: "warn", detail: "Could not read the phone number's status." });
    }
  }

  if (wabaId) {
    try {
      const res = await fetch(`${WA_API_URL}/${wabaId}?fields=account_review_status&access_token=${token}`);
      const json = await res.json();
      if (!json?.error) {
        const approved = json.account_review_status === "APPROVED";
        checks.push({
          name: "Account review",
          status: approved ? "pass" : "warn",
          detail: `Meta review status: ${json.account_review_status ?? "unknown"}`,
        });
      }
    } catch {}
  }

  // Billing eligibility cannot be read from the Graph API without billing
  // permissions, so surface the last real send failure instead — Meta reports
  // error 131042 ("Business eligibility payment issue") only on an actual send.
  const { data: lastErrRow } = await supabase
    .from("wa_connections")
    .select("last_error, last_error_at")
    .eq("user_id", session.id)
    .single();

  if (lastErrRow?.last_error) {
    const blocked = /131042|eligibility|payment/i.test(lastErrRow.last_error);
    checks.push({
      name: blocked ? "Billing / payment method" : "Last send error",
      status: "fail",
      detail: lastErrRow.last_error,
    });
  }

  // What is actually stored, and does it match what Meta reports?
  const { data: conn } = await supabase
    .from("wa_connections")
    .select("phone_number_id, waba_id, status")
    .eq("user_id", session.id)
    .single();

  if (conn) {
    const mismatch = phoneNumberId && conn.phone_number_id !== phoneNumberId;
    checks.push({
      name: "Saved connection",
      status: mismatch || conn.phone_number_id === conn.waba_id ? "fail" : "pass",
      detail: mismatch
        ? `Stored phone_number_id ${conn.phone_number_id} does not match Meta's ${phoneNumberId}. Inbound messages are being dropped — reload this page to repair it.`
        : `status=${conn.status}, phone_number_id=${conn.phone_number_id}, waba_id=${conn.waba_id}`,
    });
  }

  return NextResponse.json({ ok: Boolean(wabaId && phoneNumberId), checks });
}
