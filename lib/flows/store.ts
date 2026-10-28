import { postWebhook } from "./webhook";
import type { FlowStore, FlowRecord, SessionRecord } from "./runtime";

/** Flow storage in Supabase. */
export function supabaseFlowStore(db: any): FlowStore {
  const SESSION_COLS = "id, user_id, flow_id, phone, contact_name, status, current_node_id, variables, retries, waiting_until";
  const FLOW_COLS = "id, user_id, name, trigger_type, keywords, exit_keywords, published_definition";
  return {
    async getLiveSession(userId, phone) {
      const { data } = await db.from("wa_flow_sessions").select(SESSION_COLS)
        .eq("user_id", userId).eq("phone", phone).in("status", ["active", "waiting"]).maybeSingle();
      return (data as SessionRecord) ?? null;
    },
    async getFlow(flowId) {
      const { data } = await db.from("wa_flows").select(FLOW_COLS).eq("id", flowId).maybeSingle();
      return (data as FlowRecord) ?? null;
    },
    async listPublishedFlows(userId) {
      const { data } = await db.from("wa_flows").select(FLOW_COLS).eq("user_id", userId).eq("status", "published");
      return ((data ?? []) as FlowRecord[]).filter((f) => f.published_definition);
    },
    async createSession(row) {
      const { data, error } = await db.from("wa_flow_sessions").insert(row).select(SESSION_COLS).single();
      if (error) {
        if (error.code === "23505") return null; // the customer is already in a live conversation
        throw error;
      }
      return data as SessionRecord;
    },
    async saveSession(id, patch) {
      const { error } = await db.from("wa_flow_sessions").update(patch).eq("id", id);
      if (error) throw error;
    },
    postWebhook: (url, body) => postWebhook(url, body),
    async insertLead(lead) {
      const { error } = await db.from("wa_leads").insert(lead);
      if (error) throw error;
    },
    async addLabel(userId, phone, label) {
      await db.rpc("add_contact_label", { p_user: userId, p_phone: phone, p_label: label });
    },
    async markNeedsHuman(userId, phone, note) {
      await db.from("wa_conversations").upsert(
        { user_id: userId, phone, needs_human_at: new Date().toISOString(), human_note: note, updated_at: new Date().toISOString() },
        { onConflict: "user_id,phone" }
      );
    },
    async logOutbound(userId, phone, content, kind, waMessageId) {
      await db.from("wa_messages").insert({
        user_id: userId, wa_message_id: waMessageId, to_phone: phone, direction: "outbound",
        message_type: kind === "text" ? "text" : "interactive", content, status: "sent",
      });
    },
  };
}
