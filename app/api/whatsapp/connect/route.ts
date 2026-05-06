import { getSession } from "@/lib/auth/session";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getPhoneNumberInfo } from "@/lib/whatsapp/service";

const WA_API_URL = "https://graph.facebook.com/v21.0";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code, wabaId, phoneNumberId } = await req.json();

    if (!code) {
      return NextResponse.json({ error: "Missing OAuth code" }, { status: 400 });
    }

    // 1. Exchange code for User Access Token
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      console.error("Missing FACEBOOK_APP_ID or FACEBOOK_APP_SECRET in .env");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const tokenRes = await fetch(
      `${WA_API_URL}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}`,
      { method: "GET" }
    );
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("Token Exchange Error:", tokenData);
      return NextResponse.json({ error: "Failed to exchange token with Meta." }, { status: 500 });
    }

    const systemUserToken = tokenData.access_token;

    // 2. Fetch Display Phone Number
    let phoneNumber = "Verified Number";
    let displayName = "Unknown";
    
    if (phoneNumberId) {
      try {
        const waInfo = await getPhoneNumberInfo(phoneNumberId, systemUserToken);
        if (waInfo.display_phone_number) phoneNumber = waInfo.display_phone_number;
        if (waInfo.verified_name) displayName = waInfo.verified_name;
      } catch (err) {
        console.warn("Could not fetch phone info, continuing...", err);
      }
    }

    // 3. Register Phone Number (Required by Meta Docs to start messaging)
    if (phoneNumberId) {
      // In a real production environment, you might need to handle the PIN properly.
      // For Embedded Signup, the user already verified the number in the UI, 
      // but Meta sometimes requires a registration API call to activate Cloud API routing.
      const registerRes = await fetch(`${WA_API_URL}/${phoneNumberId}/register`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${systemUserToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ messaging_product: "whatsapp", pin: "123456" })
      });
    }

    // 4. Subscribe App to WABA Webhooks
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

    const { error: dbError } = await supabase
      .from("wa_connections")
      .upsert({
        user_id: session.id,
        phone_number_id: phoneNumberId || "pending",
        waba_id: wabaId || "pending",
        access_token: systemUserToken,
        phone_number: phoneNumber,
        display_name: displayName,
        status: 'active'
      }, { onConflict: "user_id" });

    if (dbError) {
      console.error("DB Error:", dbError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ success: true, phoneNumber, displayName });
  } catch (error: any) {
    console.error("WA Connect Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const { error: dbError } = await supabase
      .from("wa_connections")
      .delete()
      .eq("user_id", session.id);

    if (dbError) {
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
