import { getSession } from "@/lib/auth/session";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getPhoneNumberInfo } from "@/lib/whatsapp/service";

const WA_API_URL = "https://graph.facebook.com/v25.0";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized. Please sign in again." }, { status: 401 });
    }

    const { code, wabaId, phoneNumberId } = await req.json();

    if (!code) {
      return NextResponse.json({ error: "Missing authorization code from Meta." }, { status: 400 });
    }

    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      return NextResponse.json({ error: "Server configuration error: Missing App ID or Secret." }, { status: 500 });
    }

    // For FB JS SDK popup flow (FB.login), do NOT include redirect_uri in token exchange.
    // The code is issued against Facebook's internal SDK callback, not the app's URL.
    // Including redirect_uri causes a mismatch error from Meta.
    const tokenRes = await fetch(`${WA_API_URL}/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: appId,
        client_secret: appSecret,
        grant_type: "authorization_code",
        code,
      }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("WhatsApp Token Exchange Error:", JSON.stringify(tokenData));
      return NextResponse.json({
        error: tokenData.error?.message || "Meta rejected the token exchange.",
      }, { status: 500 });
    }

    const systemUserToken = tokenData.access_token;

    // 2. Fetch Display Phone Number
    let phoneNumber = "Verified Number";
    let displayName = "WhatsApp Business Account";
    
    if (phoneNumberId) {
      try {
        const waInfo = await getPhoneNumberInfo(phoneNumberId, systemUserToken);
        if (waInfo.display_phone_number) phoneNumber = waInfo.display_phone_number;
        if (waInfo.verified_name) displayName = waInfo.verified_name;
      } catch (err) {
        console.warn("Could not fetch phone info, continuing...", err);
      }
    }

    // 3. Subscribe App to WABA Webhooks
    if (wabaId) {
      await fetch(`${WA_API_URL}/${wabaId}/subscribed_apps`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${systemUserToken}`,
          "Content-Type": "application/json"
        }
      });
    }

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

    // 4. Save connection to DB
    const { error: dbError } = await supabase
      .from("wa_connections")
      .upsert({
        user_id: session.id,
        phone_number_id: phoneNumberId || "unknown",
        waba_id: wabaId || "unknown",
        phone_number: phoneNumber,
        display_name: displayName,
        access_token: systemUserToken,
        status: 'active',
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });

    if (dbError) {
      console.error("Database Error:", dbError);
      return NextResponse.json({ error: "Failed to save connection to database." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Connect Route Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
