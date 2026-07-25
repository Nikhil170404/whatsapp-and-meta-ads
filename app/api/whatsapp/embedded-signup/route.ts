import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { NextResponse } from "next/server";

/**
 * Mobile-safe entry point for WhatsApp Embedded Signup.
 * Instead of FB.login() (which opens a dead-end new tab on mobile),
 * this redirects the user into Facebook's OAuth dialog with a redirect_uri
 * pointing back to our callback handler. Works on all browsers and devices.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(`${env.APP_URL}/signin?redirect=/wa/connect`);
  }

  const appId = env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const configId = env.NEXT_PUBLIC_FB_CONFIG_ID;

  if (!appId || !configId) {
    return NextResponse.redirect(`${env.APP_URL}/wa/connect?error=Server+configuration+error`);
  }

  const redirectUri = `${env.APP_URL}/api/whatsapp/embedded-signup/callback`;

  const url = new URL("https://www.facebook.com/v25.0/dialog/oauth");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("config_id", configId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("display", "page");

  return NextResponse.redirect(url.toString());
}
