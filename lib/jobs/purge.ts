/**
 * Data minimisation (Meta policy, DPDP Act 2023 s.8(7)): message bodies are
 * erased after 90 days, and worker run history after 30.
 */
export const MESSAGE_RETENTION_DAYS = 90;

export async function runPurge(supabase: any) {
  const cutoff = new Date(Date.now() - MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from("wa_messages")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);
  if (error) throw error;

  const { data: runsPurged } = await supabase.rpc("purge_old_worker_runs");

  return { purged: count ?? 0, workerRunsPurged: runsPurged ?? 0, cutoff };
}
