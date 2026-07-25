import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { NextResponse } from "next/server";

/**
 * Initiates WhatsApp Embedded Signup via a full-page redirect to Facebook OAuth.
 * Works on both mobile and desktop — no popup, no window.opener dependency.
 * Uses /wa/connect as the redirect_uri (already whitelisted in Meta App settings).
 */
export async function GET() {
  const appUrl = env.APP_URL.replace(/\/$/, "");
  const session = await getSession();

  if (!session) {
    return NextResponse.redirect(`${appUrl}/signin?redirect=/wa/connect`);
  }

  const appId = env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const configId = env.NEXT_PUBLIC_FB_CONFIG_ID;

  if (!appId || !configId) {
    return NextResponse.redirect(`${appUrl}/wa/connect?error=Server+configuration+error`);
  }

  const url = new URL("https://www.facebook.com/v25.0/dialog/oauth");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", `${appUrl}/wa/connect`);
  url.searchParams.set("config_id", configId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("display", "page");
  // Required when config_id is present — without it Facebook ignores response_type=code.
  url.searchParams.set("override_default_response_type", "true");
  // Drives the Embedded Signup asset-selection screens. Keys are case-sensitive.
  url.searchParams.set("extras", JSON.stringify({ setup: {}, featureType: "", sessionInfoVersion: "3" }));
  // NOTE: no `scope` param — the Login-for-Business Config ID defines the permissions,
  // and passing both makes Facebook fall back to plain OAuth with no WhatsApp assets.

  return NextResponse.redirect(url.toString());
}
