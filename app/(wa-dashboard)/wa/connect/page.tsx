import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { env } from "@/lib/env";
import { redirect } from "next/navigation";
import { WaConnectClient } from "./WaConnectClient";
import { resolveWabaFromToken, fetchPhoneDetails } from "@/lib/whatsapp/waba-lookup";

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

    // 3. Resolve WABA + phone number via debug_token granular_scopes (authoritative).
    const { wabaId, phoneNumberId, diagnostics } = await resolveWabaFromToken(finalToken, appId, appSecret);

    const supabase = getSupabaseAdmin() as any;

    // Always keep the freshest user token, even if no WABA is attached to it.
    await supabase.from("users").update({ fb_access_token: finalToken, fb_token_expires_at: tokenExpiresAt }).eq("id", userId);

    // 4. No WABA on this token — do not fabricate an "active" connection. Report why.
    if (!wabaId) {
      await supabase
        .from("wa_connections")
        .update({ status: "disconnected", last_error: diagnostics.join(" | "), last_error_at: new Date().toISOString() })
        .eq("user_id", userId);
      return { success: false, error: encodeURIComponent(diagnostics.join(" | ") || "No WhatsApp Business Account is attached to this Facebook account.") };
    }

    // 5. Enrich with the phone number's display number and verified business name.
    let phoneNumber = "Verified Number";
    let displayName = "WhatsApp Business";
    if (phoneNumberId) {
      const details = await fetchPhoneDetails(phoneNumberId, finalToken);
      if (details?.display_phone_number) phoneNumber = details.display_phone_number;
      if (details?.verified_name) displayName = details.verified_name;
    }

    // 6. Subscribe the app to this WABA's webhooks.
    await fetch(`${WA_API_URL}/${wabaId}/subscribed_apps`, {
      method: "POST",
      headers: { Authorization: `Bearer ${finalToken}`, "Content-Type": "application/json" },
    }).catch(() => {});

    // 7. Save the connection.
    const { error: dbError } = await supabase.from("wa_connections").upsert(
      {
        user_id: userId,
        phone_number_id: phoneNumberId || "unknown",
        waba_id: wabaId,
        phone_number: phoneNumber,
        display_name: displayName,
        access_token: finalToken,
        token_expires_at: tokenExpiresAt,
        status: "active",
        last_error: null,
        last_error_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (dbError) return { success: false, error: "Database+error" };

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
  const { data: row } = await supabase
    .from("wa_connections")
    .select("*")
    .eq("user_id", session.id)
    .single();

  // A row with no real WABA ID is not a usable connection — older builds saved these
  // as "active". Surface it as not-connected so the user gets the signup button back,
  // while still showing why the previous attempt failed.
  const isUsable = row?.status === "active" && row?.waba_id && row.waba_id !== "unknown";
  const connection = isUsable ? row : null;
  const previousError: string | null = !isUsable ? row?.last_error ?? null : null;

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Connect WhatsApp</h1>
        <p className="text-slate-500 font-medium mt-1">Link your WhatsApp Business Account to enable API access and automations.</p>
      </div>

      <WaConnectClient initialConnection={connection} previousError={previousError} />
    </div>
  );
}
