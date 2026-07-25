import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { NextResponse } from "next/server";

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

    // Check if the token already has WhatsApp WABA access
    const wabaRes = await fetch(
      `${WA_API_URL}/me/whatsapp_business_accounts?fields=id,phone_numbers{id,display_phone_number,verified_name}&access_token=${token}`
    );
    const wabaData = await wabaRes.json();

    const firstWaba = wabaData?.data?.[0];
    if (!firstWaba?.id) {
      return NextResponse.json(
        { error: "Stored token does not have WhatsApp Business access. Manual signup required." },
        { status: 404 }
      );
    }

    const firstPhone = firstWaba?.phone_numbers?.data?.[0];

    // Subscribe app to webhooks for this WABA
    await fetch(`${WA_API_URL}/${firstWaba.id}/subscribed_apps`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    }).catch(() => {});

    const expiresAt = userRow?.fb_token_expires_at ?? new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    await supabase.from("wa_connections").upsert(
      {
        user_id: session.id,
        phone_number_id: firstPhone?.id || "unknown",
        waba_id: firstWaba.id,
        phone_number: firstPhone?.display_phone_number || "Verified Number",
        display_name: firstPhone?.verified_name || "WhatsApp Business",
        access_token: token,
        token_expires_at: expiresAt,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    return NextResponse.json({ success: true, waba_id: firstWaba.id });
  } catch (err) {
    console.error("auto-connect error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
