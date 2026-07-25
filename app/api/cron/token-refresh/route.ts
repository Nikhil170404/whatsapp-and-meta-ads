import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { refreshWaTokenFull } from "@/lib/whatsapp/token";

/**
 * Proactive token-refresh cron — runs daily.
 *
 * Meta long-lived tokens expire after ~60 days. We refresh any token
 * that has fewer than 30 days remaining so users never hit an expired
 * token mid-automation. If a refresh fails we write the failure time
 * so the dashboard can show a warning banner.
 *
 * Secured with CRON_SECRET (same pattern as other crons).
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin() as any;

  // Fetch all active connections that have a token_expires_at set.
  // We load them all and let refreshWaTokenFull decide if refresh is needed.
  const { data: connections, error } = await supabase
    .from("wa_connections")
    .select("phone_number_id, access_token, token_expires_at, user_id")
    .eq("status", "active")
    .not("token_expires_at", "is", null);

  if (error) {
    console.error("[token-refresh] DB read error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!connections?.length) {
    return NextResponse.json({ refreshed: 0, failed: 0, skipped: 0 });
  }

  let refreshed = 0;
  let failed = 0;
  let skipped = 0;

  for (const conn of connections) {
    const result = await refreshWaTokenFull(supabase, conn);

    if (result.refreshed) {
      refreshed++;
      // Clear any previous refresh failure marker on success
      await supabase
        .from("wa_connections")
        .update({ token_refresh_failed_at: null })
        .eq("phone_number_id", conn.phone_number_id);
    } else if (result.error === "token_expired" || result.error?.startsWith("meta_error")) {
      // Token is expired or Meta rejected the refresh — mark for dashboard warning
      failed++;
      await supabase
        .from("wa_connections")
        .update({
          token_refresh_failed_at: new Date().toISOString(),
          status: result.error === "token_expired" ? "expired" : "active",
          last_error: `Token refresh failed: ${result.error}`,
          last_error_at: new Date().toISOString(),
        })
        .eq("phone_number_id", conn.phone_number_id);

      console.warn(
        `[token-refresh] Failed for phone_number_id=${conn.phone_number_id}: ${result.error}`
      );
    } else {
      // Not in refresh window yet — nothing to do
      skipped++;
    }
  }

  console.log(`[token-refresh] refreshed=${refreshed} failed=${failed} skipped=${skipped}`);
  return NextResponse.json({ refreshed, failed, skipped });
}
