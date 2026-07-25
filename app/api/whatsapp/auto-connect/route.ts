import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { NextResponse } from "next/server";
import { resolveWabaFromToken, fetchPhoneDetails } from "@/lib/whatsapp/waba-lookup";

const WA_API_URL = "https://graph.facebook.com/v25.0";

/**
 * Tries to connect WhatsApp using the access token already stored from the
 * user's Facebook login — no second FB.login() required. This works when the
 * login Config ID already includes WhatsApp Embedded Signup permissions.
 * Returns 200 on success, 404 when the stored token lacks WhatsApp access.
 */
export async function POST() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin() as any;

    const { data: userRow } = await supabase
      .from("users")
      .select("fb_access_token, fb_token_expires_at")
      .eq("id", session.id)
      .single();

    const token = userRow?.fb_access_token;
    if (!token) return NextResponse.json({ error: "No stored token" }, { status: 404 });

    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appId || !appSecret) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // Resolve via debug_token granular_scopes — the only method that works for
    // System Users and Business-Portfolio-owned WABAs.
    const { wabaId, phoneNumberId, diagnostics } = await resolveWabaFromToken(token, appId, appSecret);

    if (!wabaId) {
      return NextResponse.json(
        { error: "Stored token has no WhatsApp Business Account attached.", diagnostics },
        { status: 404 }
      );
    }

    let phoneNumber = "Verified Number";
    let displayName = "WhatsApp Business";
    if (phoneNumberId) {
      const details = await fetchPhoneDetails(phoneNumberId, token);
      if (details?.display_phone_number) phoneNumber = details.display_phone_number;
      if (details?.verified_name) displayName = details.verified_name;
    }

    // Subscribe app to webhooks for this WABA
    await fetch(`${WA_API_URL}/${wabaId}/subscribed_apps`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    }).catch(() => {});

    const expiresAt = userRow?.fb_token_expires_at ?? new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    await supabase.from("wa_connections").upsert(
      {
        user_id: session.id,
        phone_number_id: phoneNumberId || "unknown",
        waba_id: wabaId,
        phone_number: phoneNumber,
        display_name: displayName,
        access_token: token,
        token_expires_at: expiresAt,
        status: "active",
        last_error: null,
        last_error_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    return NextResponse.json({ success: true, waba_id: wabaId });
  } catch (err) {
    console.error("auto-connect error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
