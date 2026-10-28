/**
 * The flow engine: given a flow, where the customer is, and what they just did, it decides what
 * to send next. It is pure (no database, no network) so the editor's preview, the tests and the
 * live WhatsApp runtime all behave identically.
 */
import { validateInput, RETRY_HINT } from "./inputs";
import {
  FLOW_LIMITS, type FlowButton, type FlowDefinition, type FlowEdge, type FlowNode, type FlowRow, type NodeDataMap,
} from "./types";

/** A readable file name for a document link, for example "price-list.pdf". */
export function fileNameOf(url: string): string {
  try { const last = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() ?? ""); return last || "document"; } catch { return "document"; }
}

export type Action =
  | { type: "text"; text: string }
  | { type: "image"; url: string; caption?: string }
  | { type: "video"; url: string; caption?: string }
  | { type: "document"; url: string; filename: string; caption?: string }
  | { type: "buttons"; text: string; buttons: FlowButton[] }
  | { type: "list"; text: string; buttonLabel: string; rows: FlowRow[] }
  | { type: "location_request"; text: string }
  | { type: "cta_url"; text: string; label: string; url: string }
  | { type: "delay"; seconds: number }
  | { type: "tag"; label: string }
  | { type: "lead"; fields: Record<string, string>; note?: string }
  | { type: "handoff"; note?: string }
  | { type: "webhook"; url: string; fields: Record<string, string> };

export type SessionStatus = "active" | "waiting" | "completed" | "handoff" | "abandoned";

export interface Session {
  currentNodeId: string | null;
  variables: Record<string, string>;
  retries: number;
  status: SessionStatus;
  /** Why it ended, for reporting: completed, cancelled, gave_up, loop, missing_node, handoff. */
  endedReason?: string;
  /** When status is "waiting": how long the wait block asked for. */
  waitSeconds?: number;
}

export type Inbound =
  | { kind: "text"; text: string }
  | { kind: "reply"; id: string; title: string }
  | { kind: "location"; latitude: number; longitude: number; name?: string; address?: string }
  | { kind: "other" };

export interface Ctx { contactName?: string | null; phone: string }
export interface StepResult { session: Session; actions: Action[]; visited: string[] }

export const MAX_STEPS = 60;

export function newSession(): Session {
  return { currentNodeId: null, variables: {}, retries: 0, status: "active" };
}

/** Fills {{variables}} in a message. Unknown variables become empty rather than showing braces. */
export function render(text: string, vars: Record<string, string>, ctx: Ctx, encode = false): string {
  return text.replace(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/gi, (_m, name: string) => {
    const k = name.toLowerCase();
    const value = k === "contact_name" ? ctx.contactName?.trim() || "there"
      : k === "phone" ? (ctx.phone.startsWith("+") ? ctx.phone : `+${ctx.phone}`)
      : vars[k] ?? "";
    // Inside a link, what a customer typed must not be able to change the link's host, path or other parameters.
    return encode ? encodeURIComponent(value) : value;
  });
}

const norm = (s: string) => s.trim().toLowerCase();

function target(edges: FlowEdge[], nodeId: string, handle: string): string | null {
  return edges.find((e) => e.source === nodeId && e.sourceHandle === handle)?.target ?? null;
}

function clone(s: Session): Session {
  return { ...s, variables: { ...s.variables } };
}

/** Walks blocks from `fromId` until the flow needs the customer, waits, or ends. */
function run(flow: FlowDefinition, session: Session, fromId: string | null, ctx: Ctx, actions: Action[], visited: string[]) {
  const byId = new Map(flow.nodes.map((n) => [n.id, n]));
  let id = fromId;
  let steps = 0;

  while (id) {
    if (++steps > MAX_STEPS) {
      actions.push({ type: "text", text: "Sorry, something went wrong on our side. Please try again in a moment." });
      session.status = "abandoned"; session.endedReason = "loop"; session.currentNodeId = null;
      return;
    }
    const node = byId.get(id) as FlowNode | undefined;
    if (!node) { session.status = "abandoned"; session.endedReason = "missing_node"; session.currentNodeId = null; return; }
    visited.push(node.id);
    const v = session.variables;

    switch (node.type) {
      case "start":
        id = target(flow.edges, node.id, "next");
        break;
      case "message": {
        const d = node.data as NodeDataMap["message"];
        const text = render(d.text ?? "", v, ctx);
        if (d.documentUrl) actions.push({ type: "document", url: d.documentUrl, filename: d.documentName?.trim() || fileNameOf(d.documentUrl), caption: text || undefined });
        else if (d.videoUrl) actions.push({ type: "video", url: d.videoUrl, caption: text || undefined });
        else if (d.imageUrl) actions.push({ type: "image", url: d.imageUrl, caption: text || undefined });
        else if (text) actions.push({ type: "text", text });
        id = target(flow.edges, node.id, "next");
        break;
      }
      case "buttons": {
        const d = node.data as NodeDataMap["buttons"];
        actions.push({ type: "buttons", text: render(d.text, v, ctx), buttons: d.buttons });
        session.currentNodeId = node.id; session.retries = 0; session.status = "active";
        return;
      }
      case "list": {
        const d = node.data as NodeDataMap["list"];
        actions.push({ type: "list", text: render(d.text, v, ctx), buttonLabel: d.buttonLabel, rows: d.rows });
        session.currentNodeId = node.id; session.retries = 0; session.status = "active";
        return;
      }
      case "question": {
        const d = node.data as NodeDataMap["question"];
        actions.push({ type: "text", text: render(d.text, v, ctx) });
        session.currentNodeId = node.id; session.retries = 0; session.status = "active";
        return;
      }
      case "location": {
        const d = node.data as NodeDataMap["location"];
        actions.push({ type: "location_request", text: render(d.text, v, ctx) });
        session.currentNodeId = node.id; session.retries = 0; session.status = "active";
        return;
      }
      case "webhook": {
        const d = node.data as NodeDataMap["webhook"];
        actions.push({ type: "webhook", url: d.url, fields: { ...v, contact_name: ctx.contactName ?? "", phone: ctx.phone } });
        id = target(flow.edges, node.id, "next");
        break;
      }
      case "pay": {
        const d = node.data as NodeDataMap["pay"];
        actions.push({ type: "cta_url", text: render(d.text, v, ctx), label: d.buttonLabel, url: render(d.url, v, ctx, true) });
        id = target(flow.edges, node.id, "next");
        break;
      }
      case "condition": {
        const d = node.data as NodeDataMap["condition"];
        const have = v[d.variable];
        const want = norm(d.value ?? "");
        const yes =
          d.op === "exists" ? !!have :
          d.op === "not_exists" ? !have :
          d.op === "equals" ? norm(have ?? "") === want :
          norm(have ?? "").includes(want) && want !== "";
        id = target(flow.edges, node.id, yes ? "yes" : "no");
        break;
      }
      case "wait": {
        const d = node.data as NodeDataMap["wait"];
        const next = target(flow.edges, node.id, "next");
        if (!next) { id = null; break; } // nothing after the wait: just finish
        actions.push({ type: "delay", seconds: d.seconds });
        session.status = "waiting"; session.waitSeconds = d.seconds; session.currentNodeId = next;
        return;
      }
      case "tag": {
        const d = node.data as NodeDataMap["tag"];
        if (d.label?.trim()) actions.push({ type: "tag", label: d.label.trim() });
        id = target(flow.edges, node.id, "next");
        break;
      }
      case "lead": {
        const d = node.data as NodeDataMap["lead"];
        actions.push({ type: "lead", fields: { ...v }, note: d.note });
        id = target(flow.edges, node.id, "next");
        break;
      }
      case "handoff": {
        const d = node.data as NodeDataMap["handoff"];
        const text = render(d.text ?? "", v, ctx);
        if (text) actions.push({ type: "text", text });
        actions.push({ type: "handoff", note: d.note });
        session.status = "handoff"; session.endedReason = "handoff"; session.currentNodeId = null;
        return;
      }
      case "end": {
        const d = node.data as NodeDataMap["end"];
        const text = render(d.text ?? "", v, ctx);
        if (text) actions.push({ type: "text", text });
        session.status = "completed"; session.endedReason = "completed"; session.currentNodeId = null;
        return;
      }
    }
  }
  session.status = "completed"; session.endedReason = "completed"; session.currentNodeId = null;
}

export function startFlow(flow: FlowDefinition, ctx: Ctx): StepResult {
  const session = newSession();
  const actions: Action[] = [];
  const visited: string[] = [];
  const start = flow.nodes.find((n) => n.type === "start");
  if (!start) { session.status = "abandoned"; session.endedReason = "missing_node"; return { session, actions, visited }; }
  run(flow, session, start.id, ctx, actions, visited);
  return { session, actions, visited };
}

/** The timer a wait block asked for has elapsed. */
export function continueAfterWait(flow: FlowDefinition, prev: Session, ctx: Ctx): StepResult {
  const session = clone(prev);
  session.status = "active"; session.waitSeconds = undefined;
  const actions: Action[] = [];
  const visited: string[] = [];
  run(flow, session, session.currentNodeId, ctx, actions, visited);
  return { session, actions, visited };
}

function reprompt(node: FlowNode, ctx: Ctx, vars: Record<string, string>): Action[] {
  if (node.type === "buttons") {
    const d = node.data as NodeDataMap["buttons"];
    return [{ type: "text", text: "Please tap one of the options below." }, { type: "buttons", text: render(d.text, vars, ctx), buttons: d.buttons }];
  }
  if (node.type === "list") {
    const d = node.data as NodeDataMap["list"];
    return [{ type: "text", text: "Please choose one of the options from the menu." }, { type: "list", text: render(d.text, vars, ctx), buttonLabel: d.buttonLabel, rows: d.rows }];
  }
  if (node.type === "location") {
    const d = node.data as NodeDataMap["location"];
    return [{ type: "text", text: "Please tap the button below and share your location." }, { type: "location_request", text: render(d.text, vars, ctx) }];
  }
  const d = node.data as NodeDataMap["question"];
  return [{ type: "text", text: d.retryText?.trim() || RETRY_HINT[d.input] }, { type: "text", text: render(d.text, vars, ctx) }];
}

/** The customer answered: move the flow forward, or ask again, or give up politely. */
export function resumeFlow(flow: FlowDefinition, prev: Session, inbound: Inbound, ctx: Ctx): StepResult {
  const session = clone(prev);
  const actions: Action[] = [];
  const visited: string[] = [];
  const node = flow.nodes.find((n) => n.id === session.currentNodeId);
  if (!node) { session.status = "abandoned"; session.endedReason = "missing_node"; session.currentNodeId = null; return { session, actions, visited }; }
  visited.push(node.id);

  const giveUp = (maxRetries: number) => {
    session.retries++;
    if (session.retries <= maxRetries) { actions.push(...reprompt(node, ctx, session.variables)); return; }
    const next = target(flow.edges, node.id, "giveup");
    if (next) { session.retries = 0; run(flow, session, next, ctx, actions, visited); return; }
    actions.push({ type: "text", text: "No problem, we'll stop here. Message us any time to start again." });
    session.status = "completed"; session.endedReason = "gave_up"; session.currentNodeId = null;
  };

  const accept = (handle: string, assign?: [string, string][]) => {
    for (const [k, val] of assign ?? []) if (k) session.variables[k] = val;
    run(flow, session, target(flow.edges, node.id, handle), ctx, actions, visited);
  };

  if (node.type === "buttons") {
    const d = node.data as NodeDataMap["buttons"];
    const hit = inbound.kind === "reply" ? d.buttons.find((b) => b.id === inbound.id)
      : inbound.kind === "text" ? d.buttons.find((b) => norm(b.title) === norm(inbound.text)) : undefined;
    if (hit) accept(`btn:${hit.id}`, [[d.variable ?? "", hit.title]]); else giveUp(d.maxRetries ?? 2);
  } else if (node.type === "list") {
    const d = node.data as NodeDataMap["list"];
    const hit = inbound.kind === "reply" ? d.rows.find((r) => r.id === inbound.id)
      : inbound.kind === "text" ? d.rows.find((r) => norm(r.title) === norm(inbound.text)) : undefined;
    if (hit) accept(`row:${hit.id}`, [[d.variable ?? "", hit.title]]); else giveUp(d.maxRetries ?? 2);
  } else if (node.type === "question") {
    const d = node.data as NodeDataMap["question"];
    const text = inbound.kind === "text" ? inbound.text : inbound.kind === "reply" ? inbound.title : null;
    if (text !== null && d.skippable && norm(text) === "skip") accept("next", [[d.variable, ""]]);
    else if (text !== null) {
      const r = validateInput(d.input, text);
      if (r.ok) accept("next", [[d.variable, r.value]]); else giveUp(d.maxRetries ?? 2);
    } else giveUp(d.maxRetries ?? 2);
  } else if (node.type === "location") {
    const d = node.data as NodeDataMap["location"];
    if (inbound.kind === "location") {
      accept("next", [
        [d.variable, `${inbound.latitude},${inbound.longitude}`],
        [`${d.variable}_name`, inbound.name ?? ""],
        [`${d.variable}_address`, inbound.address ?? ""],
      ]);
    } else giveUp(d.maxRetries ?? 2);
  } else {
    run(flow, session, node.id, ctx, actions, visited);
  }
  return { session, actions, visited };
}

/** Longest reasonable wait, exported for validation and the editor. */
export const MAX_WAIT_SECONDS = FLOW_LIMITS.maxWaitSeconds;
