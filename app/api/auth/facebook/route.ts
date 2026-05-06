import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export async function GET(req: Request) {
  try {
    const appId = env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const redirectUri = `${env.APP_URL}/api/auth/facebook/callback`;
    const scope = "ads_read,pages_show_list,pages_read_engagement,public_profile";

    if (!appId) {
      return NextResponse.json({ error: "Facebook App ID not configured" }, { status: 500 });
    }

    const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&response_type=code`;

    return NextResponse.redirect(authUrl);
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
