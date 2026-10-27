import { runBroadcast } from "@/lib/whatsapp/broadcast-runner";

/**
 * Sends broadcasts whose scheduled_at has passed. Each broadcast is claimed
 * with a conditional status update, so two overlapping runs never send twice.
 */
export async function runScheduledBroadcasts(supabase: any) {
  const { data: due, error } = await supabase
    .from("wa_broadcasts")
    .select("id, user_id")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .limit(20);
  if (error) throw error;
  if (!due?.length) return { processed: 0, failed: 0 };

  let processed = 0;
  let failed = 0;
  for (const broadcast of due) {
    const { data: claimed } = await supabase
      .from("wa_broadcasts")
      .update({ status: "draft", updated_at: new Date().toISOString() })
      .eq("id", broadcast.id)
      .eq("status", "scheduled")
      .select("id");
    if (!claimed?.length) continue;

    const result = await runBroadcast(supabase, broadcast.user_id, broadcast.id);
    if (result.status >= 400) {
      failed++;
      await supabase
        .from("wa_broadcasts")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", broadcast.id);
      console.error(`[scheduled-broadcasts] ${broadcast.id} failed:`, result.body);
    } else {
      processed++;
    }
  }
  return { processed, failed };
}
