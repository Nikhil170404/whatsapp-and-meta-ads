import { refreshWaTokenIfNeeded } from "@/lib/whatsapp/token";
import { continueWaitingSession, type SessionRecord } from "./runtime";
import { whatsappFlowSender } from "./sender";
import { supabaseFlowStore } from "./store";

/**
 * Continues conversations whose wait block has elapsed, and ends ones the customer abandoned.
 * Run every few seconds by the worker; many workers can run it at once.
 */
export async function runFlowTimers(db: any, limit = 50): Promise<{ continued: number; expired: number }> {
  const { data: due, error } = await db.rpc("claim_due_flow_sessions", { p_limit: limit });
  if (error) throw error;

  const store = supabaseFlowStore(db);
  let continued = 0;
  for (const session of (due ?? []) as SessionRecord[]) {
    try {
      const { data: conn } = await db.from("wa_connections").select("phone_number_id, access_token, token_expires_at, status")
        .eq("user_id", session.user_id).maybeSingle();
      if (!conn || conn.status !== "active") {
        await store.saveSession(session.id, { status: "abandoned", ended_reason: "not_connected" });
        continue;
      }
      const token = await refreshWaTokenIfNeeded(db, { access_token: conn.access_token, token_expires_at: conn.token_expires_at, phone_number_id: conn.phone_number_id });
      await continueWaitingSession({ store, sender: whatsappFlowSender({ phoneNumberId: conn.phone_number_id, token, to: session.phone }) }, session);
      continued++;
    } catch (err: any) {
      console.error(`[flow-timers] session ${session.id} failed:`, err?.message ?? err);
      await store.saveSession(session.id, { status: "abandoned", ended_reason: "send_failed" }).catch(() => {});
    }
  }

  const { data: expired } = await db.rpc("expire_stale_flow_sessions", { p_hours: 23 });
  return { continued, expired: expired ?? 0 };
}
