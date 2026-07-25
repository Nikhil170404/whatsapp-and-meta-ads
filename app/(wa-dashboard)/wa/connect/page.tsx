import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { env } from "@/lib/env";
import { redirect } from "next/navigation";
import { WaConnectClient } from "./WaConnectClient";
import { getPhoneNumberInfo } from "@/lib/whatsapp/service";

const WA_API_URL = "https://graph.facebook.com/v25.0";

async function handleCodeExchange(code: string, userId: string): Promise<{ success: boolean; error?: string }> {
  const appUrl = env.APP_URL.replace(/\/$/, "");
  const appId = env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  if (!appId || !appSecret) return { success: false, error: "Server+configuration+error" };

  const redirectUri = `${appUrl}/wa/connect`;

  try {
    // 1. Exchange code for short-lived token
    const tokenParams = new URLSearchParams({ client_id: appId, client_secret: appSecret, code, redirect_uri: redirectUri });
    const tokenRes = await fetch(`${WA_API_URL}/oauth/access_token?${tokenParams.toString()}`);
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return { success: false, error: encodeURIComponent(tokenData.error?.message || "Token exchange failed") };
    }

    // 2. Exchange for long-lived token (~60 days)
    let finalToken = tokenData.access_token;
    let tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    try {
      const llRes = await fetch(`${WA_API_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${finalToken}`);
      const llData = await llRes.json();
      if (llData.access_token) {
        finalToken = llData.access_token;
        tokenExpiresAt = new Date(Date.now() + (llData.expires_in || 60 * 24 * 60 * 60) * 1000).toISOString();
      }
    } catch {}

    // 3. Get WABA ID and phone number ID from granular_scopes.
    // Embedded Signup populates this with exactly what the user selected — works for all
    // account types including System Users where /me/whatsapp_business_accounts is empty.
    let resolvedWabaId: string | null = null;
    let resolvedPhoneNumberId: string | null = null;
    try {
      const scopesRes = await fetch(`${WA_API_URL}/me?fields=granular_scopes&access_token=${finalToken}`);
      const scopesData = await scopesRes.json();
      for (const s of scopesData?.granular_scopes || []) {
        if (s.scope === "whatsapp_business_management" && s.target_ids?.[0]) resolvedWabaId = s.target_ids[0];
        if (s.scope === "whatsapp_business_messaging" && s.target_ids?.[0]) resolvedPhoneNumberId = s.target_ids[0];
      }
    } catch {}

    // 4. Resolve WABA node details using the IDs we already know
    let firstWaba: any = null;
    if (resolvedWabaId) {
      try {
        const wabaRes = await fetch(`${WA_API_URL}/${resolvedWabaId}?fields=id,phone_numbers{id,display_phone_number,verified_name}&access_token=${finalToken}`);
        const wabaNode = await wabaRes.json();
        if (wabaNode?.id) firstWaba = wabaNode;
      } catch {}
    }

    // 4b. Fallback — direct user/business listing endpoints
    if (!firstWaba?.id) {
      try {
        const wabaRes = await fetch(`${WA_API_URL}/me/whatsapp_business_accounts?fields=id,phone_numbers{id,display_phone_number,verified_name}&access_token=${finalToken}`);
        const wabaData = await wabaRes.json();
        firstWaba = wabaData?.data?.[0] || null;
      } catch {}
    }
    if (!firstWaba?.id) {
      try {
        const bizRes = await fetch(`${WA_API_URL}/me/businesses?fields=id,whatsapp_business_accounts{id,phone_numbers{id,display_phone_number,verified_name}}&access_token=${finalToken}`);
        const bizData = await bizRes.json();
        for (const biz of bizData?.data || []) {
          const waba = biz?.whatsapp_business_accounts?.data?.[0];
          if (waba?.id) { firstWaba = waba; break; }
        }
      } catch {}
    }

    const firstPhone = firstWaba?.phone_numbers?.data?.[0];
    const phoneNumberId = resolvedPhoneNumberId || firstPhone?.id || "unknown";
    const wabaId = resolvedWabaId || firstWaba?.id || "unknown";
    let phoneNumber = firstPhone?.display_phone_number || "Verified Number";
    let displayName = firstPhone?.verified_name || "WhatsApp Business";

    if (phoneNumberId && phoneNumberId !== "unknown") {
      try {
        const info = await getPhoneNumberInfo(phoneNumberId, finalToken);
        if (info.display_phone_number) phoneNumber = info.display_phone_number;
        if (info.verified_name) displayName = info.verified_name;
      } catch {}
    }

    // 5. Subscribe webhooks
    if (wabaId !== "unknown") {
      await fetch(`${WA_API_URL}/${wabaId}/subscribed_apps`, {
        method: "POST",
        headers: { Authorization: `Bearer ${finalToken}`, "Content-Type": "application/json" },
      }).catch(() => {});
    }

    // 6. Save connection
    const supabase = getSupabaseAdmin() as any;
    const { error: dbError } = await supabase.from("wa_connections").upsert(
      { user_id: userId, phone_number_id: phoneNumberId, waba_id: wabaId, phone_number: phoneNumber, display_name: displayName, access_token: finalToken, token_expires_at: tokenExpiresAt, status: "active", updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    if (dbError) return { success: false, error: "Database+error" };

    // 6. Update stored user token
    await supabase.from("users").update({ fb_access_token: finalToken, fb_token_expires_at: tokenExpiresAt }).eq("id", userId).catch(() => {});

    return { success: true };
  } catch {
    return { success: false, error: "Internal+server+error" };
  }
}

export default async function WaConnectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await getSession();
  if (!session) redirect("/signin");

  const params = await searchParams;

  // Handle Facebook OAuth redirect back to this page with ?code=
  if (params.code && !params.success && !params.error) {
    const result = await handleCodeExchange(params.code, session.id);
    if (result.success) {
      redirect("/wa/connect?success=1");
    } else {
      redirect(`/wa/connect?error=${result.error}`);
    }
  }

  const supabase = getSupabaseAdmin() as any;
  const { data: connection } = await supabase
    .from("wa_connections")
    .select("*")
    .eq("user_id", session.id)
    .single();

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Connect WhatsApp</h1>
        <p className="text-slate-500 font-medium mt-1">Link your WhatsApp Business Account to enable API access and automations.</p>
      </div>

      <WaConnectClient initialConnection={connection} />
    </div>
  );
}
