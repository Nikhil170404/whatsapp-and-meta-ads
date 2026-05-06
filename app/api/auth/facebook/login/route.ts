import { NextResponse } from "next/server";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";

export async function POST(req: Request) {
  try {
    const { code, redirectUri } = await req.json();
    if (!code) {
      return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
    }

    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      console.error("Facebook Login: Missing env vars. APP_ID present:", !!appId, "APP_SECRET present:", !!appSecret);
      return NextResponse.json({ error: "Server config error: Missing Facebook App ID or Secret" }, { status: 500 });
    }

    // 1. Exchange code for access token
    // CRITICAL: We use the EXACT redirect_uri sent from the frontend to ensure a match
    const resolvedRedirectUri = redirectUri || `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')}/signin`;

    console.log("Facebook Login: exchanging code with redirect_uri:", resolvedRedirectUri);

    const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}&redirect_uri=${encodeURIComponent(resolvedRedirectUri)}`;
    
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
      console.error("Meta Login Token Exchange Error:", JSON.stringify(tokenData));
      return NextResponse.json({
        error: "Facebook rejected the login exchange.",
        details: tokenData.error?.message || tokenData.error_description || "Redirect URI mismatch or invalid code."
      }, { status: 401 });
    }

    const accessToken = tokenData.access_token;

    // 2. Fetch User Info from Facebook
    const meRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name,email,picture&access_token=${accessToken}`);
    const meData = await meRes.json();

    if (!meData.id) {
      return NextResponse.json({ error: "Failed to fetch user profile from Facebook." }, { status: 500 });
    }

    const supabase = getSupabaseAdmin();

    // 3. Upsert User in the 'users' table
    const { data: user, error: dbError } = await (supabase.from("users") as any)
      .upsert({
        facebook_user_id: meData.id,
        display_name: meData.name,
        fb_access_token: accessToken,
        fb_token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        email: meData.email || null,
        profile_picture_url: meData.picture?.data?.url || null,
        plan_type: 'free'
      }, { onConflict: "facebook_user_id" })
      .select("*")
      .single();

    if (dbError || !user) {
      console.error("DB Login Error:", dbError);
      return NextResponse.json({ error: "Database error during login sequence." }, { status: 500 });
    }

    // 4. Create and set the session cookie
    const sessionToken = await createSession(user);
    await setSessionCookie(sessionToken);

    return NextResponse.json({ 
      success: true, 
      user: {
        id: user.id,
        name: user.display_name,
        email: user.email
      }
    });
  } catch (error: any) {
    console.error("Facebook Login Route Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
