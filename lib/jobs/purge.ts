/**
 * Data minimisation (Meta policy, DPDP Act 2023 s.8(7)): message bodies are erased after 90
 * days, and worker run history after 30. Deleted in batches so a very large table is never
 * locked by one huge statement.
 */
export const MESSAGE_RETENTION_DAYS = 90;
const BATCH = 10_000;
const MAX_BATCHES = 500; // up to 5 million rows per run; the next run continues

export async function runPurge(supabase: any) {
  let purged = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const { data, error } = await supabase.rpc("purge_old_wa_messages_batch", { p_days: MESSAGE_RETENTION_DAYS, p_batch: BATCH });
    if (error) throw error;
    purged += data ?? 0;
    if (!data || data < BATCH) break;
  }
  const { data: runsPurged } = await supabase.rpc("purge_old_worker_runs");
  const { data: eventsPurged } = await supabase.rpc("purge_old_webhook_events");
  return { purged, workerRunsPurged: runsPurged ?? 0, webhookEventsPurged: eventsPurged ?? 0, retentionDays: MESSAGE_RETENTION_DAYS };
}
