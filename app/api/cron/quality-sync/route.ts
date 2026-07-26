import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { getPhoneNumberQuality } from "@/lib/whatsapp/service";
import { verifyCronRequest } from "@/lib/cron-auth";

/**
 * Quality-sync cron — runs once daily.
 *
 * Fetches phone-number quality rating and messaging tier from Meta for every
 * active connection and writes them to wa_connections. If quality drops to LOW:
 *   1. Writes quality_paused_at timestamp.
 *   2. Deactivates all automations for that user so no further auto-replies
 *      are sent (which would worsen the quality score).
 *
 * Users see the paused state in their dashboard and can re-enable automations
 * once Meta restores the quality rating.
 */
export async function GET(req: Request) {
  const auth = verifyCronRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const supabase = getSupabaseAdmin() as any;

  const { data: connections } = await supabase
    .from("wa_connections")
    .select("phone_number_id, access_token, user_id, quality_rating, quality_paused_at")
    .eq("status", "active");

  if (!connections?.length) return NextResponse.json({ synced: 0 });

  let synced = 0;
  let paused = 0;
  let restored = 0;

  for (const conn of connections) {
    const quality = await getPhoneNumberQuality(conn.phone_number_id, conn.access_token);
    if (!quality) continue;

    const { qualityRating, tier, messagingTier } = quality;
    const wasLow = conn.quality_rating === "LOW" || conn.quality_rating === "RED";
    const isLow = qualityRating === "LOW" || qualityRating === "RED";

    const update: Record<string, any> = {
      quality_rating: qualityRating,
      messaging_tier: messagingTier,
      messaging_limit_tier: tier,
      quality_synced_at: new Date().toISOString(),
    };

    if (isLow && !conn.quality_paused_at) {
      // Quality just dropped to LOW — pause all automations to protect the account
      update.quality_paused_at = new Date().toISOString();
      update.last_error = "Automations paused: phone number quality dropped to LOW. Improve quality before re-enabling.";
      update.last_error_at = new Date().toISOString();

      await supabase
        .from("wa_automations")
        .update({ is_active: false, last_error: "Auto-paused: phone number quality is LOW (Meta policy)" })
        .eq("user_id", conn.user_id)
        .eq("is_active", true);

      paused++;
    } else if (!isLow && conn.quality_paused_at) {
      // Quality restored — clear the pause marker (user can manually re-enable automations)
      update.quality_paused_at = null;
      update.last_error = null;
      update.last_error_at = null;
      restored++;
    }

    await supabase
      .from("wa_connections")
      .update(update)
      .eq("phone_number_id", conn.phone_number_id);

    synced++;

    if (isLow) {
      console.warn(
        `[quality-sync] LOW quality for phone_number_id=${conn.phone_number_id} user_id=${conn.user_id}`
      );
    }
  }

  console.log(`[quality-sync] synced=${synced} paused=${paused} restored=${restored}`);
  return NextResponse.json({ synced, paused, restored });
}
