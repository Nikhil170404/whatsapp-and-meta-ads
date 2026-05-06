import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${env.APP_URL}/ads/connect?error=${error || 'No code provided'}`);
  }

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.redirect(`${env.APP_URL}/signin?redirect=/ads/connect`);
    }

    // Exchange code for access token
    const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${env.NEXT_PUBLIC_FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(`${env.APP_URL}/api/auth/facebook/callback`)}&client_secret=${env.FACEBOOK_APP_SECRET}&code=${code}`;
    
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error("Token Exchange Error:", tokenData);
      return NextResponse.redirect(`${env.APP_URL}/ads/connect?error=TokenExchangeFailed`);
    }

    const accessToken = tokenData.access_token;

    // Fetch user info
    const meRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${accessToken}`);
    const meData = await meRes.json();

    // Fetch ad accounts (just taking the first one for this implementation)
    const adAccountsRes = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?fields=account_id&access_token=${accessToken}`);
    const adAccountsData = await adAccountsRes.json();
    const adAccountId = adAccountsData.data?.[0]?.account_id || "unknown_ad_account";

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // Save ad connection
    await supabase.from("ad_connections").upsert({
      user_id: session.id,
      fb_user_id: meData.id,
      ad_account_id: adAccountId,
      access_token: accessToken,
      status: 'active'
    }, { onConflict: "user_id" });

    return NextResponse.redirect(`${env.APP_URL}/ads`);
  } catch (err) {
    console.error("FB Auth Error:", err);
    return NextResponse.redirect(`${env.APP_URL}/ads/connect?error=InternalError`);
  }
}
