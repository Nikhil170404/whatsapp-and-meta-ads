import { NextResponse } from "next/server";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { env } from "@/lib/env";

// The redirect_uri must exactly match an entry in Facebook App → Facebook Login → Valid OAuth Redirect URIs.
// Registered: https://www.replykaro.in/api/auth/facebook/login
//             https://replykaro.in/api/auth/facebook/login
function getRedirectUri(): string {
  return `${env.APP_URL}/api/auth/facebook/login`;
}

// Step 1: Browser hits this URL → redirect to Facebook OAuth dialog
// Step 2: Facebook redirects back here with ?code=... → exchange and create session
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const appId = env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const appSecret = env.FACEBOOK_APP_SECRET;
  const appUrl = env.APP_URL;
  const redirectUri = getRedirectUri();

  // Facebook returned an error (e.g. user denied)
  if (error) {
    const desc = searchParams.get("error_description") || error;
    return NextResponse.redirect(`${appUrl}/signin?error=${encodeURIComponent(desc)}`);
  }

  // No code yet — redirect to Facebook OAuth
  if (!code) {
    if (!appId) {
      console.error("Facebook Login: NEXT_PUBLIC_FACEBOOK_APP_ID is not set");
      return NextResponse.redirect(`${appUrl}/signin?error=Server+configuration+error`);
    }

    const configId = env.NEXT_PUBLIC_FB_CONFIG_ID;
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "email,public_profile",
    });
    if (configId) params.set("config_id", configId);

    return NextResponse.redirect(`https://www.facebook.com/v21.0/dialog/oauth?${params}`);
  }

  // Code received — exchange for access token
  if (!appId || !appSecret) {
    console.error("Facebook Login: missing env vars. APP_ID:", !!appId, "APP_SECRET:", !!appSecret);
    return NextResponse.redirect(`${appUrl}/signin?error=Server+configuration+error`);
  }

  try {
    const tokenParams = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      code,
      redirect_uri: redirectUri,
    });
    const tokenRes = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${tokenParams}`);
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
      console.error("Facebook token exchange failed:", JSON.stringify(tokenData));
      return NextResponse.redirect(`${appUrl}/signin?error=${encodeURIComponent(tokenData.error?.message || "Token exchange failed")}`);
    }

    const accessToken = tokenData.access_token;

    const meRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name,email,picture&access_token=${accessToken}`);
    const meData = await meRes.json();

    if (!meData.id) {
      console.error("Facebook profile fetch failed:", JSON.stringify(meData));
      return NextResponse.redirect(`${appUrl}/signin?error=Failed+to+fetch+profile`);
    }

    const supabase = getSupabaseAdmin();

    const { data: user, error: dbError } = await (supabase.from("users") as any)
      .upsert({
        facebook_user_id: meData.id,
        display_name: meData.name,
        fb_access_token: accessToken,
        fb_token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        email: meData.email || null,
        profile_picture_url: meData.picture?.data?.url || null,
        plan_type: "free",
      }, { onConflict: "facebook_user_id" })
      .select("*")
      .single();

    if (dbError || !user) {
      console.error("DB upsert failed:", dbError);
      return NextResponse.redirect(`${appUrl}/signin?error=Database+error`);
    }

    const sessionToken = await createSession(user);
    await setSessionCookie(sessionToken);

    return NextResponse.redirect(`${appUrl}/wa`);
  } catch (err) {
    console.error("Facebook login GET handler error:", err);
    return NextResponse.redirect(`${appUrl}/signin?error=Internal+server+error`);
  }
}

// Kept for backwards compatibility — not used by the new flow
export async function POST(req: Request) {
  return NextResponse.json({ error: "Use GET /api/auth/facebook/login to start the OAuth flow" }, { status: 405 });
}
