import { NextResponse } from "next/server";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { env } from "@/lib/env";

/**
 * Facebook Login Server-Side Flow
 * 
 * Step 1: User hits GET /api/auth/facebook/login -> Redirect to Facebook OAuth Dialog
 * Step 2: Facebook redirects back to GET /api/auth/facebook/login?code=... -> Exchange and Create Session
 */

function getRedirectUri(): string {
  // Ensure we use the base APP_URL for the callback to match Meta settings
  const origin = env.APP_URL.replace(/\/$/, '');
  return `${origin}/api/auth/facebook/login`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const appId = env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const appSecret = env.FACEBOOK_APP_SECRET;
  const appUrl = env.APP_URL.replace(/\/$/, '');
  const redirectUri = getRedirectUri();

  // 1. Handle Facebook Errors (e.g., user clicked cancel)
  if (error) {
    const desc = searchParams.get("error_description") || error;
    console.error("Facebook OAuth Error:", desc);
    return NextResponse.redirect(`${appUrl}/signin?error=${encodeURIComponent(desc)}`);
  }

  // 2. Step 1: No code yet -> Redirect user to Facebook
  if (!code) {
    if (!appId) {
      console.error("Facebook Login: Missing NEXT_PUBLIC_FACEBOOK_APP_ID");
      return NextResponse.redirect(`${appUrl}/signin?error=Server+configuration+error`);
    }

    const configId = env.NEXT_PUBLIC_FB_CONFIG_ID;
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: "code",
    });
    
    // For Business Apps, permissions are managed via the Config ID
    if (configId) params.set("config_id", configId);
    else params.set("scope", "email,public_profile"); // Fallback for standard apps

    return NextResponse.redirect(`https://www.facebook.com/v25.0/dialog/oauth?${params.toString()}`);
  }

  // 3. Step 2: Code received -> Exchange for access token
  if (!appId || !appSecret) {
    console.error("Facebook Login: Missing app credentials in env");
    return NextResponse.redirect(`${appUrl}/signin?error=Server+configuration+error`);
  }

  try {
    const tokenParams = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      code: code,
      redirect_uri: redirectUri,
    });

    const tokenRes = await fetch(`https://graph.facebook.com/v25.0/oauth/access_token?${tokenParams.toString()}`);
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
      console.error("Facebook token exchange failed:", JSON.stringify(tokenData));
      return NextResponse.redirect(`${appUrl}/signin?error=${encodeURIComponent(tokenData.error?.message || "Token exchange failed")}`);
    }

    // Exchange short-lived token (~2 hrs) for long-lived token (~60 days)
    let accessToken = tokenData.access_token;
    let tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    try {
      const llRes = await fetch(
        `https://graph.facebook.com/v25.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${accessToken}`
      );
      const llData = await llRes.json();
      if (llData.access_token) {
        accessToken = llData.access_token;
        const expiresIn = llData.expires_in || 60 * 24 * 60 * 60;
        tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      }
    } catch (err) {
      console.warn("Could not exchange for long-lived FB token, using short-lived:", err);
    }

    // 4. Fetch Profile Info + WhatsApp WABA + Ad Accounts in parallel
    const [meRes, wabaRes, adAccountsRes, pagesRes] = await Promise.all([
      fetch(`https://graph.facebook.com/v25.0/me?fields=id,name,email,picture&access_token=${accessToken}`),
      fetch(`https://graph.facebook.com/v25.0/me/whatsapp_business_accounts?fields=id,phone_numbers{id,display_phone_number,verified_name}&access_token=${accessToken}`),
      fetch(`https://graph.facebook.com/v25.0/me/adaccounts?fields=account_id&access_token=${accessToken}`),
      fetch(`https://graph.facebook.com/v25.0/me/accounts?fields=id,name,access_token&access_token=${accessToken}`),
    ]);

    const meData = await meRes.json();
    const wabaData = await wabaRes.json().catch(() => null);
    const adAccountsData = await adAccountsRes.json().catch(() => null);
    const pagesData = await pagesRes.json().catch(() => null);

    if (!meData.id) {
      console.error("Facebook profile fetch failed:", JSON.stringify(meData));
      return NextResponse.redirect(`${appUrl}/signin?error=Failed+to+fetch+profile`);
    }

    const supabase = getSupabaseAdmin();

    // 5. Upsert User in DB
    const { data: user, error: dbError } = await (supabase.from("users") as any)
      .upsert({
        facebook_user_id: meData.id,
        display_name: meData.name,
        fb_access_token: accessToken,
        fb_token_expires_at: tokenExpiresAt,
        email: meData.email || null,
        profile_picture_url: meData.picture?.data?.url || null,
        plan_type: "free",
      }, { onConflict: "facebook_user_id" })
      .select("*")
      .single();

    if (dbError || !user) {
      console.error("DB Login Error:", dbError);
      return NextResponse.redirect(`${appUrl}/signin?error=Database+error`);
    }

    // 6. Auto-connect WhatsApp if WABA is accessible from the token
    try {
      const firstWaba = wabaData?.data?.[0];
      if (firstWaba?.id) {
        const firstPhone = firstWaba?.phone_numbers?.data?.[0];
        // Subscribe app to WABA webhooks
        await fetch(`https://graph.facebook.com/v25.0/${firstWaba.id}/subscribed_apps`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
        }).catch(() => {});
        await (supabase.from("wa_connections") as any).upsert({
          user_id: user.id,
          phone_number_id: firstPhone?.id || "unknown",
          waba_id: firstWaba.id,
          phone_number: firstPhone?.display_phone_number || "Verified Number",
          display_name: firstPhone?.verified_name || "WhatsApp Business",
          access_token: accessToken,
          token_expires_at: tokenExpiresAt,
          status: "active",
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      }
    } catch (err) {
      console.warn("Auto WhatsApp connect skipped:", err);
    }

    // 7. Auto-connect Meta Ads if ad account is accessible from the token
    try {
      const adAccountId = adAccountsData?.data?.[0]?.account_id;
      const firstPage = pagesData?.data?.[0];
      if (adAccountId) {
        await (supabase.from("ad_connections") as any).upsert({
          user_id: user.id,
          fb_user_id: meData.id,
          ad_account_id: adAccountId,
          page_id: firstPage?.id || null,
          page_access_token: firstPage?.access_token || null,
          access_token: accessToken,
          status: "active",
        }, { onConflict: "user_id" });
      }
    } catch (err) {
      console.warn("Auto Meta Ads connect skipped:", err);
    }

    // 8. Create Session and Redirect to Dashboard
    const sessionToken = await createSession(user);
    await setSessionCookie(sessionToken);

    return NextResponse.redirect(`${appUrl}/wa`);
  } catch (err) {
    console.error("Internal OAuth Handler Error:", err);
    return NextResponse.redirect(`${appUrl}/signin?error=Internal+server+error`);
  }
}
