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

    return NextResponse.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`);
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

    const tokenRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams.toString()}`);
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
      console.error("Facebook token exchange failed:", JSON.stringify(tokenData));
      return NextResponse.redirect(`${appUrl}/signin?error=${encodeURIComponent(tokenData.error?.message || "Token exchange failed")}`);
    }

    const accessToken = tokenData.access_token;

    // 4. Fetch Profile Info
    const meRes = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name,email,picture&access_token=${accessToken}`);
    const meData = await meRes.json();

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
        fb_token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
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

    // 6. Create Session and Redirect to Dashboard
    const sessionToken = await createSession(user);
    await setSessionCookie(sessionToken);

    return NextResponse.redirect(`${appUrl}/wa`);
  } catch (err) {
    console.error("Internal OAuth Handler Error:", err);
    return NextResponse.redirect(`${appUrl}/signin?error=Internal+server+error`);
  }
}

// Keep POST for legacy support (returns error instructing to use GET)
export async function POST() {
  return NextResponse.json({ error: "Use GET /api/auth/facebook/login to start the OAuth flow" }, { status: 405 });
}
