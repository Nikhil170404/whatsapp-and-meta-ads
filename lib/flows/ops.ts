/** Creating, saving, publishing and testing flows. Used by the dashboard API. */
import { PRICING_PLANS } from "@/lib/pricing";
import { refreshWaTokenIfNeeded } from "@/lib/whatsapp/token";
import { normalizePhone } from "@/lib/whatsapp/phone";
import { handleFlowInbound } from "./runtime";
import { whatsappFlowSender } from "./sender";
import { supabaseFlowStore } from "./store";
import { blankFlow, FLOW_TEMPLATES } from "./templates";
import { autoLayout } from "./layout";
import { hasErrors, sanitize, validateFlow, type FlowIssue } from "./validate";
import { DEFAULT_EXIT_KEYWORDS, type FlowDefinition, type FlowNode, type FlowSettings, type NodeType } from "./types";

export type FlowResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string; code?: string; issues?: FlowIssue[] };
const ok = <T,>(data: T): FlowResult<T> => ({ ok: true, data });
const fail = (status: number, error: string, code?: string, issues?: FlowIssue[]): FlowResult<never> => ({ ok: false, status, error, code, issues });

const NODE_TYPES = new Set<NodeType>(["start", "message", "buttons", "list", "question", "location", "condition", "wait", "tag", "lead", "handoff", "end"]);
export const MAX_NODES = 150;
export const MAX_EDGES = 400;

/** Accepts only a well-formed flow from the browser, so stored data is always safe to run. */
export function parseDefinition(raw: any): FlowDefinition | null {
  if (!raw || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) return null;
  if (raw.nodes.length > MAX_NODES || raw.edges.length > MAX_EDGES) return null;
  const ids = new Set<string>();
  const nodes: FlowNode[] = [];
  for (const n of raw.nodes) {
    if (!n || typeof n.id !== "string" || n.id.length > 60 || ids.has(n.id) || !NODE_TYPES.has(n.type) || typeof n.data !== "object" || n.data === null) return null;
    ids.add(n.id);
    nodes.push({ id: n.id, type: n.type, position: { x: Number(n.position?.x) || 0, y: Number(n.position?.y) || 0 }, data: n.data });
  }
  const edges = raw.edges
    .filter((e: any) => e && typeof e.source === "string" && typeof e.target === "string" && typeof e.sourceHandle === "string")
    .map((e: any) => ({ id: String(e.id ?? `${e.source}-${e.sourceHandle}-${e.target}`).slice(0, 200), source: e.source, sourceHandle: e.sourceHandle, target: e.target }));
  return sanitize({ nodes, edges });
}

export function parseSettings(raw: any, fallback?: Partial<FlowSettings>): FlowSettings {
  const trigger = ["keyword", "welcome", "any"].includes(raw?.trigger_type) ? raw.trigger_type : fallback?.trigger_type ?? "keyword";
  const list = (v: any, d: string[]) => Array.isArray(v) ? [...new Set(v.map((x) => String(x).trim().toLowerCase()).filter(Boolean))].slice(0, 20) : d;
  return { trigger_type: trigger, keywords: list(raw?.keywords, fallback?.keywords ?? []), exit_keywords: list(raw?.exit_keywords, fallback?.exit_keywords ?? DEFAULT_EXIT_KEYWORDS) };
}

async function planLimit(db: any, userId: string): Promise<number> {
  const { data } = await db.from("users").select("plan_type").eq("id", userId).maybeSingle();
  const key = String(data?.plan_type ?? "free").toUpperCase();
  const plan = (key in PRICING_PLANS ? key : "FREE") as keyof typeof PRICING_PLANS;
  return (PRICING_PLANS[plan]?.limits as any)?.flows ?? 1;
}

/** Keywords already used by automations and other flows, to warn about clashes. */
export async function otherKeywords(db: any, userId: string, exceptFlowId?: string): Promise<string[]> {
  const [{ data: autos }, { data: flows }] = await Promise.all([
    db.from("wa_automations").select("trigger_keyword").eq("user_id", userId).eq("is_active", true).not("trigger_keyword", "is", null),
    db.from("wa_flows").select("id, keywords").eq("user_id", userId).eq("status", "published"),
  ]);
  return [
    ...(autos ?? []).map((a: any) => String(a.trigger_keyword).toLowerCase()),
    ...(flows ?? []).filter((f: any) => f.id !== exceptFlowId).flatMap((f: any) => f.keywords ?? []),
  ];
}

export async function listFlows(db: any, userId: string) {
  const [{ data: flows, error }, { data: stats }] = await Promise.all([
    db.from("wa_flows").select("id, name, description, status, trigger_type, keywords, version, published_at, updated_at, definition").eq("user_id", userId).order("updated_at", { ascending: false }),
    db.rpc("flow_stats", { p_user: userId }),
  ]);
  if (error) return fail(500, error.message);
  const by = new Map((stats ?? []).map((s: any) => [s.flow_id, s]));
  return ok((flows ?? []).map(({ definition, ...f }: any) => ({ ...f, blocks: definition?.nodes?.length ?? 0, stats: by.get(f.id) ?? null })));
}

export async function getFlow(db: any, userId: string, id: string) {
  const { data, error } = await db.from("wa_flows").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) return fail(500, error.message);
  if (!data) return fail(404, "Flow not found.");
  return ok(data);
}

export async function createFlow(db: any, userId: string, input: { name?: string; template_id?: string }) {
  const { count } = await db.from("wa_flows").select("id", { count: "exact", head: true }).eq("user_id", userId);
  const limit = await planLimit(db, userId);
  if ((count ?? 0) >= limit) return fail(403, `Your plan includes ${limit === 9999999 ? "unlimited" : limit} flow${limit === 1 ? "" : "s"}. Upgrade to build more.`, "LIMIT_REACHED");

  const tpl = FLOW_TEMPLATES.find((t) => t.id === input.template_id);
  const base = tpl ?? { ...blankFlow(), name: "", description: "" };
  const name = (input.name?.trim() || tpl?.name || "Untitled flow").slice(0, 80);
  const { data, error } = await db.from("wa_flows").insert({
    user_id: userId, name, description: tpl?.description ?? null,
    trigger_type: base.settings.trigger_type, keywords: base.settings.keywords, exit_keywords: base.settings.exit_keywords,
    definition: autoLayout(base.definition),
  }).select().single();
  if (error) return fail(500, error.message);
  return ok(data);
}

export async function updateFlow(db: any, userId: string, id: string, body: any) {
  const current = await getFlow(db, userId, id);
  if (!current.ok) return current;
  const patch: Record<string, any> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 80);
  if (typeof body.description === "string") patch.description = body.description.slice(0, 300);
  if (body.settings) {
    const s = parseSettings(body.settings, current.data);
    patch.trigger_type = s.trigger_type; patch.keywords = s.keywords; patch.exit_keywords = s.exit_keywords;
  }
  if (body.definition !== undefined) {
    const def = parseDefinition(body.definition);
    if (!def) return fail(400, "The flow could not be saved because its data is not valid.", "INVALID_FLOW");
    patch.definition = def;
  }
  if (!Object.keys(patch).length) return ok(current.data);
  const { data, error } = await db.from("wa_flows").update(patch).eq("id", id).eq("user_id", userId).select().single();
  if (error) return fail(500, error.message);
  return ok(data);
}

export async function deleteFlow(db: any, userId: string, id: string) {
  const { data, error } = await db.from("wa_flows").delete().eq("id", id).eq("user_id", userId).select("id").maybeSingle();
  if (error) return fail(500, error.message);
  return data ? ok({ deleted: true }) : fail(404, "Flow not found.");
}

export async function duplicateFlow(db: any, userId: string, id: string) {
  const f = await getFlow(db, userId, id);
  if (!f.ok) return f;
  const made = await createFlow(db, userId, { name: `${f.data.name} (copy)` });
  if (!made.ok) return made;
  return updateFlow(db, userId, made.data.id, { definition: f.data.definition, settings: { trigger_type: f.data.trigger_type, keywords: [], exit_keywords: f.data.exit_keywords } });
}

/** Puts the draft live, but only if it has no errors. Customers run this copy until it is republished. */
export async function publishFlow(db: any, userId: string, id: string) {
  const f = await getFlow(db, userId, id);
  if (!f.ok) return f;
  const def = parseDefinition(f.data.definition);
  if (!def) return fail(400, "This flow is damaged and cannot be published.", "INVALID_FLOW");
  const issues = validateFlow(def, f.data, { otherKeywords: await otherKeywords(db, userId, id) });
  if (hasErrors(issues)) {
    return fail(400, `Fix ${issues.filter((i) => i.level === "error").length} problem(s) before publishing.`, "FLOW_HAS_ERRORS", issues);
  }
  const { data, error } = await db.from("wa_flows").update({
    status: "published", published_definition: def, published_at: new Date().toISOString(), version: (f.data.version ?? 0) + 1,
  }).eq("id", id).eq("user_id", userId).select().single();
  if (error) return fail(500, error.message);
  return ok({ flow: data, warnings: issues.filter((i) => i.level === "warning") });
}

export async function unpublishFlow(db: any, userId: string, id: string) {
  // Conversations already in progress are ended politely rather than left hanging.
  await db.from("wa_flow_sessions").update({ status: "abandoned", ended_reason: "flow_unpublished" }).eq("flow_id", id).eq("user_id", userId).in("status", ["active", "waiting"]);
  const { data, error } = await db.from("wa_flows").update({ status: "draft" }).eq("id", id).eq("user_id", userId).select().maybeSingle();
  if (error) return fail(500, error.message);
  return data ? ok(data) : fail(404, "Flow not found.");
}

/**
 * Runs the published flow on a real phone. WhatsApp only allows free-form messages inside the
 * customer's 24-hour window, so the person must have written to your number recently.
 */
export async function testOnWhatsApp(db: any, userId: string, id: string, rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  if (!phone) return fail(400, "Enter the phone number with the country code, for example +919876543210.");
  const f = await getFlow(db, userId, id);
  if (!f.ok) return f;
  if (f.data.status !== "published" || !f.data.published_definition) return fail(409, "Publish the flow first. The preview tests drafts; the WhatsApp test runs the published version.", "NOT_PUBLISHED");

  const { data: conn } = await db.from("wa_connections").select("phone_number_id, access_token, token_expires_at, status").eq("user_id", userId).maybeSingle();
  if (!conn || conn.status !== "active") return fail(400, "Connect your WhatsApp number first.", "NOT_CONNECTED");

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await db.from("wa_messages").select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("from_phone", phone).eq("direction", "inbound").gte("created_at", since);
  if (!count) {
    return fail(409, "That number has not messaged you in the last 24 hours, so WhatsApp will not deliver free-form messages to it. From that phone, send any message to your WhatsApp number (or reply to a template), then try again.", "OUTSIDE_24H_WINDOW");
  }

  const token = await refreshWaTokenIfNeeded(db, { access_token: conn.access_token, token_expires_at: conn.token_expires_at, phone_number_id: conn.phone_number_id });
  const live = await supabaseFlowStore(db).getLiveSession(userId, phone);
  if (live) return fail(409, "That number is already in a conversation with a flow. Send “cancel” from that phone, then try again.", "ALREADY_IN_FLOW");

  const started = await handleFlowInbound(
    { store: supabaseFlowStore(db), sender: whatsappFlowSender({ phoneNumberId: conn.phone_number_id, token, to: phone }) },
    { userId, phone, contactName: null, inbound: { kind: "text", text: "" }, messageId: "", isFirstMessage: false, forceFlowId: id }
  );
  return started ? ok({ started: true }) : fail(500, "The flow could not be started.");
}
