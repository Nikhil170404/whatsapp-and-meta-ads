import type { SupabaseClient } from "@supabase/supabase-js";

const WA_API_URL = "https://graph.facebook.com/v25.0";

// Refresh proactively when < 30 days remain (token valid ~60 days).
// This ensures cron jobs refresh well before actual expiry.
const REFRESH_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

export interface TokenRefreshResult {
  token: string;
  refreshed: boolean;
  expiresAt: string | null;
  error?: string;
}

export async function refreshWaTokenIfNeeded(
  supabase: SupabaseClient,
  connection: {
    access_token: string;
    token_expires_at: string | null;
    phone_number_id: string;
  },
  options: { force?: boolean } = {}
): Promise<string> {
  const result = await refreshWaTokenFull(supabase, connection, options);
  return result.token;
}

/**
 * Full token refresh with result metadata — used by the token-refresh cron
 * so it can report whether a refresh actually happened and what the new expiry is.
 */
export async function refreshWaTokenFull(
  supabase: SupabaseClient,
  connection: {
    access_token: string;
    token_expires_at: string | null;
    phone_number_id: string;
  },
  options: { force?: boolean } = {}
): Promise<TokenRefreshResult> {
  const base: TokenRefreshResult = {
    token: connection.access_token,
    refreshed: false,
    expiresAt: connection.token_expires_at,
  };

  if (!connection.token_expires_at && !options.force) return base;

  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at).getTime()
    : 0;
  const now = Date.now();

  // Already expired — caller should mark status and notify user
  if (now >= expiresAt && !options.force) {
    return { ...base, error: "token_expired" };
  }

  // Not within refresh window yet
  if (!options.force && expiresAt - now > REFRESH_THRESHOLD_MS) return base;

  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) return { ...base, error: "missing_app_credentials" };

  try {
    const res = await fetch(
      `${WA_API_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${connection.access_token}`
    );
    const data = await res.json();

    if (data.error) {
      return { ...base, error: `meta_error_${data.error.code}: ${data.error.message}` };
    }

    if (!data.access_token) return { ...base, error: "no_token_in_response" };

    // Meta returns expires_in in seconds; default to 60 days
    const expiresIn = data.expires_in || 60 * 24 * 60 * 60;
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    await supabase
      .from("wa_connections")
      .update({
        access_token: data.access_token,
        token_expires_at: newExpiresAt,
        status: "active",
        last_error: null,
        last_error_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("phone_number_id", connection.phone_number_id);

    return { token: data.access_token, refreshed: true, expiresAt: newExpiresAt };
  } catch (err: any) {
    return { ...base, error: err?.message || "refresh_failed" };
  }
}
