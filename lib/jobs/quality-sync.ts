import { decryptSecret } from "@/lib/crypto/secrets";
import { getPhoneNumberQuality } from "@/lib/whatsapp/service";
import { parseQuality } from "@/lib/whatsapp/limits";

/**
 * Reads each active number's quality rating (GREEN / YELLOW / RED) and messaging limit
 * from Meta and stores them as reported. When a number turns RED:
 *   1. promotions are paused (quality_paused_at is set), and
 *   2. keyword automations are switched off so no further auto-replies make it worse.
 * When quality recovers the pause marker is cleared; the owner turns automations back on.
 */
export async function runQualitySync(supabase: any) {
  const { data: connections } = await supabase
    .from("wa_connections")
    .select("phone_number_id, access_token, user_id, quality_rating, quality_paused_at")
    .eq("status", "active");

  if (!connections?.length) return { synced: 0, paused: 0, restored: 0 };

  let synced = 0, paused = 0, restored = 0;

  for (const conn of connections) {
    const quality = await getPhoneNumberQuality(conn.phone_number_id, decryptSecret(conn.access_token));
    if (!quality) continue;

    const isPoor = parseQuality(quality.qualityRating).level === "poor";
    const update: Record<string, any> = {
      quality_rating: quality.qualityRating,
      messaging_limit_tier: quality.messagingLimitTier,
      quality_synced_at: new Date().toISOString(),
    };

    if (isPoor && !conn.quality_paused_at) {
      update.quality_paused_at = new Date().toISOString();
      update.last_error = "Promotions and auto-replies paused: your number's quality rating is Poor (red). Too many people blocked or reported messages. Improve content and audience before resuming.";
      update.last_error_at = new Date().toISOString();
      await supabase.from("wa_automations")
        .update({ is_active: false, last_error: "Auto-paused: phone number quality is Poor (Meta policy protection)" })
        .eq("user_id", conn.user_id).eq("is_active", true);
      paused++;
    } else if (!isPoor && conn.quality_paused_at) {
      update.quality_paused_at = null;
      update.last_error = null;
      update.last_error_at = null;
      restored++;
    }

    await supabase.from("wa_connections").update(update).eq("phone_number_id", conn.phone_number_id);
    synced++;
    if (isPoor) console.warn(`[quality-sync] Poor quality for phone_number_id=${conn.phone_number_id} user_id=${conn.user_id}`);
  }

  console.log(`[quality-sync] synced=${synced} paused=${paused} restored=${restored}`);
  return { synced, paused, restored };
}
