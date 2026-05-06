import { logger } from "@/lib/logger";

export const INSTAGRAM_CONFIG = {
  appId: process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID!,
  appSecret: process.env.INSTAGRAM_APP_SECRET!,
  // 2025 Standard: Instagram Business Login Scopes (Pageless Flow)
  scopes: [
    "instagram_business_basic",
    "instagram_business_manage_messages",
    "instagram_business_manage_comments",
  ].join(","),
};

/**
 * Robust Redirect URI logic
 * Ensures the URI used for auth matches the current request domain (www vs root)
 */
export function getInstagramRedirectUri(requestUrl?: string): string {
  // Use the provided request URL to detect the current host
  // Fallback to NEXT_PUBLIC_APP_URL for server-side processing
  const baseUrl = requestUrl
    ? new URL(requestUrl).origin
    : (process.env.NEXT_PUBLIC_APP_URL || 'https://www.replykaro.in');

  return `${baseUrl}/api/auth/instagram/callback`;
}

export function getInstagramAuthUrl(state: string, requestUrl?: string): string {
  const redirectUri = getInstagramRedirectUri(requestUrl);

  return (
    `https://www.instagram.com/oauth/authorize?` +
    `enable_fb_login=0` +         // Forces Instagram-only (Native flow)
    `&force_authentication=1` +
    `&client_id=${INSTAGRAM_CONFIG.appId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${INSTAGRAM_CONFIG.scopes}` +
    `&response_type=code` +
    `&state=${state}`
  );
}

export async function exchangeCodeForToken(code: string, requestUrl?: string) {
  const redirectUri = getInstagramRedirectUri(requestUrl);

  // Exchange code for Instagram Access Token (Short-Lived)
  const response = await fetch(
    `https://api.instagram.com/oauth/access_token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: INSTAGRAM_CONFIG.appId,
        client_secret: INSTAGRAM_CONFIG.appSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code: code,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    logger.error("Token exchange error", { category: "auth" }, new Error(error.error_message || "Token exchange failed"));
    throw new Error(error.error_message || "Token exchange failed");
  }

  return response.json();
}

/**
 * Exchange Short-Lived Token for Long-Lived Token (60 days)
 * CRITICAL for background automation/webhooks.
 */
export async function exchangeShortLivedForLongLived(shortLivedToken: string) {
  // 2025 Standard: Native Instagram token exchange
  const response = await fetch(
    `https://graph.instagram.com/access_token?` +
    `grant_type=ig_exchange_token` +
    `&client_secret=${INSTAGRAM_CONFIG.appSecret}` +
    `&access_token=${shortLivedToken}`
  );

  if (!response.ok) {
    const errorData = await response.json();
    logger.error("Long-lived exchange error", { category: "auth" }, new Error(JSON.stringify(errorData)));
    return null; // Fallback to short-lived if exchange fails
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Refresh an existing Long-Lived Token (Extends another 60 days)
 * Can only be refreshed if it's at least 24 hours old and not expired.
 */
export async function refreshLongLivedToken(longLivedToken: string) {
  const response = await fetch(
    `https://graph.instagram.com/refresh_access_token?` +
    `grant_type=ig_refresh_token` +
    `&access_token=${longLivedToken}`
  );

  if (!response.ok) {
    const errorData = await response.json();
    logger.error("Token refresh error", { category: "auth" }, new Error(JSON.stringify(errorData)));
    return null;
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in
  };
}

/**
 * Gets the profile information for the Instagram Business account
 * Note: For the new Instagram Login flow, the token already represents the IG account.
 */
export async function getInstagramProfile(accessToken: string) {
  // 2025 Standard: Use /me to get the correct Graph ID for the current token.
  // CRITICAL: 'id' is the App-Scoped ID (ASID), 'user_id' is the Real Instagram ID (IGID).
  // We need IGID for webhook matching.
  const response = await fetch(
    `https://graph.instagram.com/v21.0/me?fields=user_id,id,username,profile_picture_url&access_token=${accessToken}`
  );

  if (!response.ok) {
    const errorData = await response.json();
    logger.error("Profile fetch error", { category: "auth" }, new Error(errorData.error?.message || "Failed to get Instagram profile"));
    throw new Error(errorData.error?.message || "Failed to get Instagram profile");
  }

  return response.json();
}
