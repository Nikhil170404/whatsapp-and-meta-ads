import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
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

    const tokenUrl = `https://graph.facebook.com/v25.0/oauth/access_token?client_id=${env.NEXT_PUBLIC_FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(`${env.APP_URL}/api/auth/facebook/callback`)}&client_secret=${env.FACEBOOK_APP_SECRET}&code=${code}`;

    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
      const msg = tokenData.error?.message || "TokenExchangeFailed";
      console.error("Token Exchange Error:", tokenData);
      return NextResponse.redirect(`${env.APP_URL}/ads/connect?error=${encodeURIComponent(msg)}`);
    }

    const accessToken = tokenData.access_token;

    const [meRes, adAccountsRes, pagesRes] = await Promise.all([
      fetch(`https://graph.facebook.com/v25.0/me?fields=id,name&access_token=${accessToken}`),
      fetch(`https://graph.facebook.com/v25.0/me/adaccounts?fields=account_id&access_token=${accessToken}`),
      fetch(`https://graph.facebook.com/v25.0/me/accounts?fields=id,name,access_token&access_token=${accessToken}`),
    ]);

    const meData = await meRes.json();
    const adAccountsData = await adAccountsRes.json();
    const pagesData = await pagesRes.json();

    const adAccountId = adAccountsData.data?.[0]?.account_id || null;
    const firstPage = pagesData.data?.[0];
    const pageId = firstPage?.id || null;
    const pageAccessToken = firstPage?.access_token || null;

    if (!meData.id) {
      return NextResponse.redirect(`${env.APP_URL}/ads/connect?error=${encodeURIComponent("Could not fetch Facebook profile. Please try again.")}`);
    }

    const supabase = getSupabaseAdmin() as any;

    const { error: upsertError } = await supabase.from("ad_connections").upsert({
      user_id: session.id,
      fb_user_id: meData.id,
      ad_account_id: adAccountId || "unknown",
      page_id: pageId,
      page_access_token: pageAccessToken,
      access_token: accessToken,
      status: 'active',
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (upsertError) {
      console.error("ad_connections upsert failed:", upsertError);
      return NextResponse.redirect(`${env.APP_URL}/ads/connect?error=${encodeURIComponent(upsertError.message)}`);
    }

    return NextResponse.redirect(`${env.APP_URL}/ads/connect`);
  } catch (err) {
    console.error("FB Auth Error:", err);
    return NextResponse.redirect(`${env.APP_URL}/ads/connect?error=InternalError`);
  }
}
