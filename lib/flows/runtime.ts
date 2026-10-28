/**
 * Runs flows on real conversations. It decides what to do when a customer writes (start a flow,
 * continue one, end one) and carries out what the engine asks for: send messages with natural
 * pauses, add labels, save leads, hand over to a person, and schedule waits.
 *
 * Storage and WhatsApp are reached through two small interfaces so the whole thing can be tested
 * without a database or a network.
 */
import { pickAutomation } from "@/lib/whatsapp/flow";
import { continueAfterWait, newSession, resumeFlow, startFlow, type Action, type Ctx, type Inbound, type Session, type StepResult } from "./engine";
import { DEFAULT_EXIT_KEYWORDS, type FlowDefinition } from "./types";

export interface FlowRecord {
  id: string;
  user_id: string;
  name: string;
  trigger_type: "keyword" | "welcome" | "any";
  keywords: string[];
  exit_keywords: string[];
  published_definition: FlowDefinition | null;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  flow_id: string;
  phone: string;
  contact_name: string | null;
  status: Session["status"];
  current_node_id: string | null;
  variables: Record<string, string>;
  retries: number;
  waiting_until?: string | null;
}

export interface FlowStore {
  getLiveSession(userId: string, phone: string): Promise<SessionRecord | null>;
  getFlow(flowId: string): Promise<FlowRecord | null>;
  listPublishedFlows(userId: string): Promise<FlowRecord[]>;
  createSession(row: Omit<SessionRecord, "id">): Promise<SessionRecord | null>;
  saveSession(id: string, patch: Partial<SessionRecord> & { ended_reason?: string | null; last_inbound_message_id?: string | null }): Promise<void>;
  insertLead(lead: { user_id: string; flow_id: string; flow_name: string; phone: string; name: string | null; email: string | null; fields: Record<string, string>; note?: string }): Promise<void>;
  addLabel(userId: string, phone: string, label: string): Promise<void>;
  markNeedsHuman(userId: string, phone: string, note: string): Promise<void>;
  logOutbound(userId: string, phone: string, content: string, kind: string, waMessageId: string | null): Promise<void>;
  /** Sends collected details to the business's own URL. Never throws; a failure must not stop the conversation. */
  postWebhook?(url: string, body: unknown): Promise<boolean>;
}

/** Sends one message action. Returns the WhatsApp message id. */
export interface FlowSender {
  send(action: Action): Promise<string | null>;
  /** Blue ticks and "typing…" for the customer's last message. */
  typing(messageId: string): Promise<void>;
}

export class WindowClosedError extends Error {}

const sleepMs = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A natural pause before each message after the first: longer after a long message so it can be
 * read. This also keeps us well away from WhatsApp's limit on bursts to one person (Meta does not
 * publish the figure, so we simply avoid bursts).
 */
export function pauseBeforeMs(previous: Action | null): number {
  if (!previous) return 0;
  const chars = previous.type === "text" ? previous.text.length : previous.type === "image" || previous.type === "video" || previous.type === "document" ? (previous.caption?.length ?? 0) : 40;
  return Math.min(4000, 800 + chars * 15);
}

export const actionPreview = (a: Action): string => {
  switch (a.type) {
    case "text": return a.text;
    case "image": return a.caption ? `[Image] ${a.caption}` : "[Image]";
    case "video": return a.caption ? `[Video] ${a.caption}` : "[Video]";
    case "document": return `[Document ${a.filename}]${a.caption ? " " + a.caption : ""}`;
    case "buttons": return `[Buttons] ${a.text} → ${a.buttons.map((b) => b.title).join(" · ")}`;
    case "list": return `[Menu] ${a.text} → ${a.rows.map((r) => r.title).join(" · ")}`;
    case "location_request": return `[Location request] ${a.text}`;
    case "cta_url": return `[${a.label}] ${a.text}`;
    default: return "";
  }
};

const MESSAGE_ACTIONS = new Set(["text", "image", "video", "document", "buttons", "list", "location_request", "cta_url"]);

interface RunDeps { store: FlowStore; sender: FlowSender; sleep?: (ms: number) => Promise<void>; now?: () => Date }

/** Applies the engine's actions. Returns the wait (seconds) it stopped at, if any. */
async function execute(deps: RunDeps, flow: FlowRecord, session: SessionRecord, actions: Action[], ctx: Ctx): Promise<number | null> {
  const sleep = deps.sleep ?? sleepMs;
  let previous: Action | null = null;
  for (const a of actions) {
    if (MESSAGE_ACTIONS.has(a.type)) {
      const pause = pauseBeforeMs(previous);
      if (pause) await sleep(pause);
      const id = await deps.sender.send(a);
      await deps.store.logOutbound(session.user_id, session.phone, actionPreview(a), a.type, id);
      previous = a;
    } else if (a.type === "delay") {
      return a.seconds;
    } else if (a.type === "tag") {
      await deps.store.addLabel(session.user_id, session.phone, a.label);
    } else if (a.type === "lead") {
      const f = a.fields;
      await deps.store.insertLead({
        user_id: session.user_id, flow_id: flow.id, flow_name: flow.name, phone: session.phone,
        name: f.name || ctx.contactName || null, email: f.email || null, fields: f, note: a.note,
      });
    } else if (a.type === "webhook") {
      const ok = await deps.store.postWebhook?.(a.url, { event: "flow.details", flow: { id: flow.id, name: flow.name }, phone: session.phone, details: a.fields, sent_at: new Date().toISOString() }).catch(() => false);
      if (ok === false) console.warn(`[flow ${flow.id}] webhook was not accepted by ${new URL(a.url).host}`);
    } else if (a.type === "handoff") {
      await deps.store.markNeedsHuman(session.user_id, session.phone, a.note ?? `From flow “${flow.name}”`);
    }
  }
  return null;
}

/** Saves where the conversation stands after a step. */
async function persist(deps: RunDeps, record: SessionRecord, s: Session, waitSeconds: number | null, messageId?: string) {
  const now = (deps.now ?? (() => new Date()))();
  const waiting = waitSeconds !== null && s.status === "waiting";
  await deps.store.saveSession(record.id, {
    status: s.status, current_node_id: s.currentNodeId, variables: s.variables, retries: s.retries,
    ended_reason: s.endedReason ?? null,
    waiting_until: waiting ? new Date(now.getTime() + waitSeconds! * 1000).toISOString() : null,
    ...(messageId ? { last_inbound_message_id: messageId } : {}),
  });
}

/**
 * Carries a step to its end: sends, handles short waits inline, schedules long ones.
 * A send failure ends the conversation cleanly instead of failing the whole webhook (which would
 * make Meta retry and send duplicates).
 */
async function drive(deps: RunDeps, flow: FlowRecord, record: SessionRecord, first: StepResult, ctx: Ctx, messageId?: string) {
  const def = flow.published_definition!;
  const sleep = deps.sleep ?? sleepMs;
  let step = first;
  try {
    for (let guard = 0; guard < 20; guard++) {
      const wait = await execute(deps, flow, record, step.actions, ctx);
      if (wait !== null && wait <= 3 && step.session.status === "waiting") {
        await sleep(wait * 1000); // a short pause: do it now rather than scheduling
        step = continueAfterWait(def, step.session, ctx);
        continue;
      }
      await persist(deps, record, step.session, wait, messageId);
      return;
    }
  } catch (err: any) {
    const code = err?.metaError?.code;
    console.error(`[flow ${flow.id}] send failed for ${record.phone}:`, err?.message ?? err);
    await deps.store.saveSession(record.id, { status: "abandoned", ended_reason: code === 131047 ? "window_closed" : "send_failed", current_node_id: null });
  }
}

const norm = (s: string) => s.trim().toLowerCase();

export interface InboundArgs {
  userId: string;
  phone: string;
  contactName?: string | null;
  inbound: Inbound;
  messageId: string;
  isFirstMessage: boolean;
  /** Start this specific flow regardless of its trigger (used by "test on WhatsApp"). */
  forceFlowId?: string;
}

/**
 * A customer wrote. Returns true if a flow handled the message (so simple automations must not
 * also answer), false if nothing flow-related applies.
 */
export async function handleFlowInbound(deps: RunDeps, a: InboundArgs): Promise<boolean> {
  const ctx: Ctx = { contactName: a.contactName, phone: a.phone };
  const live = await deps.store.getLiveSession(a.userId, a.phone);

  // ── Already in a flow ────────────────────────────────────────────────────
  if (live) {
    if (live.status === "waiting") return false; // mid-wait: let the flow carry on by itself
    const flow = await deps.store.getFlow(live.flow_id);
    if (!flow?.published_definition) {
      await deps.store.saveSession(live.id, { status: "abandoned", ended_reason: "flow_unpublished", current_node_id: null });
    } else {
      const text = a.inbound.kind === "text" ? norm(a.inbound.text) : "";
      const exits = (flow.exit_keywords?.length ? flow.exit_keywords : DEFAULT_EXIT_KEYWORDS).map(norm);
      if (text && exits.includes(text)) {
        await deps.sender.typing(a.messageId).catch(() => {});
        const id = await deps.sender.send({ type: "text", text: "Okay, I've stopped. Message us any time to start again." }).catch(() => null);
        await deps.store.logOutbound(a.userId, a.phone, "Okay, I've stopped. Message us any time to start again.", "text", id);
        await deps.store.saveSession(live.id, { status: "completed", ended_reason: "cancelled", current_node_id: null });
        return true;
      }
      await deps.sender.typing(a.messageId).catch(() => {});
      const session: Session = { currentNodeId: live.current_node_id, variables: live.variables ?? {}, retries: live.retries ?? 0, status: "active" };
      const step = resumeFlow(flow.published_definition, session, a.inbound, ctx);
      await drive(deps, flow, live, step, ctx, a.messageId);
      return true;
    }
  }

  // ── Should this message start a flow? ────────────────────────────────────
  const flows = await deps.store.listPublishedFlows(a.userId);
  if (!flows.length) return false;
  type Rule = { trigger_type: string; trigger_keyword: string | null; flow: FlowRecord };
  const rules: Rule[] = flows.flatMap((f): Rule[] =>
    f.trigger_type === "keyword"
      ? f.keywords.map((k) => ({ trigger_type: "keyword", trigger_keyword: k, flow: f }))
      : [{ trigger_type: f.trigger_type, trigger_keyword: null, flow: f }]
  );
  const text = a.inbound.kind === "text" ? a.inbound.text : a.inbound.kind === "reply" ? a.inbound.title : "";
  const picked = a.forceFlowId
    ? flows.find((f) => f.id === a.forceFlowId)
    : pickAutomation(rules, { text, replyId: a.inbound.kind === "reply" ? a.inbound.id : undefined }, a.isFirstMessage)?.flow;
  if (!picked?.published_definition) return false;

  const first = startFlow(picked.published_definition, ctx);
  const record = await deps.store.createSession({
    user_id: a.userId, flow_id: picked.id, phone: a.phone, contact_name: a.contactName ?? null,
    status: "active", current_node_id: null, variables: {}, retries: 0,
  });
  if (!record) return false; // another message started one at the same moment
  if (a.messageId) await deps.sender.typing(a.messageId).catch(() => {});
  await drive(deps, picked, record, first, ctx, a.messageId || undefined);
  return true;
}

/** A wait block elapsed: continue that conversation. */
export async function continueWaitingSession(deps: RunDeps, record: SessionRecord): Promise<void> {
  const flow = await deps.store.getFlow(record.flow_id);
  if (!flow?.published_definition) {
    await deps.store.saveSession(record.id, { status: "abandoned", ended_reason: "flow_unpublished", current_node_id: null });
    return;
  }
  const ctx: Ctx = { contactName: record.contact_name, phone: record.phone };
  const session: Session = { currentNodeId: record.current_node_id, variables: record.variables ?? {}, retries: record.retries ?? 0, status: "waiting" };
  await drive(deps, flow, record, continueAfterWait(flow.published_definition, session, ctx), ctx);
}

export { newSession };
