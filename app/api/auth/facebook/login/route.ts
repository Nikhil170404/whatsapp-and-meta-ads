import { NextResponse } from "next/server";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { env } from "@/lib/env";

export async function POST(req: Request) {
  try {
    const { code } = await req.json();
    if (!code) {
      return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
    }

    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.replykaro.in";

    if (!appId || !appSecret) {
      return NextResponse.json({ error: "Server config error: Missing Facebook App ID or Secret" }, { status: 500 });
    }

    // 1. Exchange code for access token
    // For JS SDK flows, Meta often expects the redirect_uri to be the origin of the login
    const redirectUri = `${appUrl.replace(/\/$/, '')}/signin`;
    const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error("Meta Login Token Exchange Error:", tokenData);
      return NextResponse.json({ 
        error: "Facebook rejected the login exchange.", 
        details: tokenData.error?.message || "Invalid OAuth code or redirect_uri mismatch."
      }, { status: 500 });
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
