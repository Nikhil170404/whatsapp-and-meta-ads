import type { SupabaseClient } from "@supabase/supabase-js";

const WA_API_URL = "https://graph.facebook.com/v25.0";
const REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // refresh if < 7 days left

export async function refreshWaTokenIfNeeded(
  supabase: SupabaseClient,
  connection: {
    access_token: string;
    token_expires_at: string | null;
    phone_number_id: string;
  }
): Promise<string> {
  if (!connection.token_expires_at) return connection.access_token;

  const expiresAt = new Date(connection.token_expires_at).getTime();
  const now = Date.now();

  // Already expired — return as-is; webhook error handler will mark it expired
  if (now >= expiresAt) return connection.access_token;

  // More than 7 days left — no need to refresh yet
  if (expiresAt - now > REFRESH_THRESHOLD_MS) return connection.access_token;

  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) return connection.access_token;

  try {
    const res = await fetch(
      `${WA_API_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${connection.access_token}`
    );
    const data = await res.json();
    if (!data.access_token) return connection.access_token;

    const expiresIn = data.expires_in || 60 * 24 * 60 * 60;
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    await supabase
      .from("wa_connections")
      .update({ access_token: data.access_token, token_expires_at: newExpiresAt, status: "active" })
      .eq("phone_number_id", connection.phone_number_id);

    return data.access_token;
  } catch {
    return connection.access_token;
  }
}
