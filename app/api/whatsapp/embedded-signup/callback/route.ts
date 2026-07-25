import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { env } from "@/lib/env";
import { NextResponse } from "next/server";
import { getPhoneNumberInfo } from "@/lib/whatsapp/service";

const WA_API_URL = "https://graph.facebook.com/v25.0";

/**
 * Callback for the mobile-safe server-side Embedded Signup redirect flow.
 * Facebook redirects here with ?code=... after the user completes the flow.
 * We exchange the code, save the connection, and redirect back to /wa/connect.
 */
export async function GET(req: Request) {
  const appUrl = env.APP_URL.replace(/\/$/, "");
  const { searchParams } = new URL(req.url);

  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDesc = searchParams.get("error_description");

  if (error) {
    const msg = errorDesc || error;
    console.error("Embedded Signup OAuth error:", msg);
    return NextResponse.redirect(`${appUrl}/wa/connect?error=${encodeURIComponent(msg)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}/wa/connect?error=No+code+returned+from+Facebook`);
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(`${appUrl}/signin?redirect=/wa/connect`);
  }

  const appId = env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  if (!appId || !appSecret) {
    return NextResponse.redirect(`${appUrl}/wa/connect?error=Server+configuration+error`);
  }

  try {
    const redirectUri = `${appUrl}/api/whatsapp/embedded-signup/callback`;

    // 1. Exchange code for short-lived token (redirect flow REQUIRES redirect_uri)
    const tokenParams = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      code,
      redirect_uri: redirectUri,
    });
    const tokenRes = await fetch(`${WA_API_URL}/oauth/access_token?${tokenParams.toString()}`);
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("Embedded Signup token exchange failed:", JSON.stringify(tokenData));
      return NextResponse.redirect(
        `${appUrl}/wa/connect?error=${encodeURIComponent(tokenData.error?.message || "Token exchange failed")}`
      );
    }

    // 2. Exchange for long-lived token (~60 days)
    let finalToken = tokenData.access_token;
    let tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    try {
      const llRes = await fetch(
        `${WA_API_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${finalToken}`
      );
      const llData = await llRes.json();
      if (llData.access_token) {
        finalToken = llData.access_token;
        const expiresIn = llData.expires_in || 60 * 24 * 60 * 60;
        tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      }
    } catch {}

    // 3. Fetch WABA info
    const wabaRes = await fetch(
      `${WA_API_URL}/me/whatsapp_business_accounts?fields=id,phone_numbers{id,display_phone_number,verified_name}&access_token=${finalToken}`
    );
    const wabaData = await wabaRes.json();
    const firstWaba = wabaData?.data?.[0];

    if (!firstWaba?.id) {
      console.error("No WABA returned after Embedded Signup:", JSON.stringify(wabaData));
      return NextResponse.redirect(
        `${appUrl}/wa/connect?error=No+WhatsApp+Business+Account+found.+Complete+Meta+Business+Verification+first.`
      );
    }

    const firstPhone = firstWaba?.phone_numbers?.data?.[0];
    const phoneNumberId = firstPhone?.id || "unknown";

    // 4. Fetch human-readable phone details
    let phoneNumber = firstPhone?.display_phone_number || "Verified Number";
    let displayName = firstPhone?.verified_name || "WhatsApp Business";
    if (phoneNumberId && phoneNumberId !== "unknown") {
      try {
        const info = await getPhoneNumberInfo(phoneNumberId, finalToken);
        if (info.display_phone_number) phoneNumber = info.display_phone_number;
        if (info.verified_name) displayName = info.verified_name;
      } catch {}
    }

    // 5. Subscribe app to WABA webhooks
    await fetch(`${WA_API_URL}/${firstWaba.id}/subscribed_apps`, {
      method: "POST",
      headers: { Authorization: `Bearer ${finalToken}`, "Content-Type": "application/json" },
    }).catch(() => {});

    const supabase = getSupabaseAdmin() as any;

    // 6. Save connection
    const { error: dbError } = await supabase.from("wa_connections").upsert(
      {
        user_id: session.id,
        phone_number_id: phoneNumberId,
        waba_id: firstWaba.id,
        phone_number: phoneNumber,
        display_name: displayName,
        access_token: finalToken,
        token_expires_at: tokenExpiresAt,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (dbError) {
      console.error("DB error saving WA connection:", dbError);
      return NextResponse.redirect(`${appUrl}/wa/connect?error=Database+error`);
    }

    // 7. Also update the user's stored access token
    await supabase
      .from("users")
      .update({ fb_access_token: finalToken, fb_token_expires_at: tokenExpiresAt })
      .eq("id", session.id)
      .catch(() => {});

    return NextResponse.redirect(`${appUrl}/wa/connect?success=1`);
  } catch (err) {
    console.error("Embedded Signup callback error:", err);
    return NextResponse.redirect(`${appUrl}/wa/connect?error=Internal+server+error`);
  }
}
