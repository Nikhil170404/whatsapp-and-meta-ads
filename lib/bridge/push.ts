import { decryptSecret } from "@/lib/crypto/secrets";
import { signedHeaders } from "@/lib/bridge/signing";

const MAX_ATTEMPTS = 12;
const TIMEOUT_MS = 10_000;

interface Row { id: number; user_id: string; attempts: number; payload: unknown }

/** Pushes due events to .com. Returns how many were delivered / retried / parked. */
export async function pushDue(db: any, fetchImpl: typeof fetch = fetch, limit = 50) {
  const { data, error } = await db.rpc("bridge_claim", { p_limit: limit, p_lease_seconds: 60 });
  if (error) throw error;
  const rows: Row[] = data ?? [];
  const stats = { delivered: 0, retried: 0, dead: 0 };
  if (!rows.length) return stats;

  const { data: links } = await db.from("bridge_links").select("user_id, link_id, com_url, signing_secret, status").in("user_id", [...new Set(rows.map((r) => r.user_id))]);
  const byUser = new Map<string, any>((links ?? []).map((l: any) => [l.user_id, l]));

  for (const row of rows) {
    const link = byUser.get(row.user_id);
    if (!link || link.status !== "active") {
      await db.rpc("bridge_finish", { p_id: row.id, p_outcome: "dead", p_error: "Link is not active" });
      stats.dead++;
      continue;
    }
    let outcome: "ok" | "retry" | "dead" = "retry";
    let message = "";
    try {
      const body = JSON.stringify(row.payload);
      const res = await fetchImpl(link.com_url, { method: "POST", headers: signedHeaders(link.link_id, decryptSecret(link.signing_secret), body), body, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.ok) outcome = "ok";
      else if (res.status === 400) { outcome = "dead"; message = "Rejected by .com (400)"; }
      else if (res.status === 401) {
        outcome = "dead"; message = "Link ID or secret rejected by .com (401)";
        await db.from("bridge_links").update({ status: "error", last_error: message }).eq("user_id", row.user_id);
      } else message = `HTTP ${res.status}`;
    } catch (err: any) {
      message = String(err?.message ?? err);
    }
    if (outcome === "retry" && row.attempts >= MAX_ATTEMPTS) outcome = "dead";
    await db.rpc("bridge_finish", { p_id: row.id, p_outcome: outcome, p_error: message || null });
    if (outcome === "ok") {
      stats.delivered++;
      await db.from("bridge_links").update({ last_push_at: new Date().toISOString(), last_error: null }).eq("user_id", row.user_id);
    } else if (outcome === "dead") stats.dead++;
    else stats.retried++;
  }
  return stats;
}
