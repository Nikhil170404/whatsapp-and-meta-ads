/**
 * Finds the mistakes in a flow before a customer meets them, in plain language, each pointing at
 * the block that needs fixing. Errors block publishing; warnings are worth a look.
 */
import {
  BUILTIN_VARIABLES, FLOW_LIMITS, VARIABLE_RE, isInputNode, outputHandles,
  type FlowDefinition, type FlowEdge, type FlowNode, type FlowSettings, type NodeDataMap, type NodeType,
} from "./types";

export interface FlowIssue {
  level: "error" | "warning";
  nodeId?: string;
  message: string;
}

export const NODE_LABELS: Record<NodeType, string> = {
  start: "Start", message: "Message", buttons: "Buttons", list: "Menu", question: "Question", location: "Location",
  condition: "Condition", wait: "Wait", tag: "Tag", lead: "Save lead", handoff: "Hand over to a person", end: "End",
};

const used = (text: string | undefined) =>
  [...(text ?? "").matchAll(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/gi)].map((m) => m[1].toLowerCase());

/** Drops connections that point at blocks, buttons or rows that no longer exist. */
export function sanitize(def: FlowDefinition): FlowDefinition {
  const byId = new Map(def.nodes.map((n) => [n.id, n]));
  const edges: FlowEdge[] = [];
  const seen = new Set<string>();
  for (const e of def.edges) {
    const src = byId.get(e.source);
    if (!src || !byId.has(e.target)) continue;
    if (!outputHandles(src).includes(e.sourceHandle)) continue;
    const key = `${e.source}|${e.sourceHandle}`; // one connection per output
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push(e);
  }
  return { nodes: def.nodes, edges };
}

export function validateFlow(def: FlowDefinition, settings?: Partial<FlowSettings>, context: { otherKeywords?: string[] } = {}): FlowIssue[] {
  const issues: FlowIssue[] = [];
  const err = (message: string, nodeId?: string) => issues.push({ level: "error", message, nodeId });
  const warn = (message: string, nodeId?: string) => issues.push({ level: "warning", message, nodeId });
  const { nodes, edges } = sanitize(def);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const label = (n: FlowNode) => NODE_LABELS[n.type];
  const out = (n: FlowNode, handle: string) => edges.find((e) => e.source === n.id && e.sourceHandle === handle)?.target ?? null;

  // ── Start and trigger ─────────────────────────────────────────────────────
  const starts = nodes.filter((n) => n.type === "start");
  if (starts.length === 0) err("Add a Start block: it is where every conversation begins.");
  if (starts.length > 1) err("A flow can have only one Start block.", starts[1].id);
  const start = starts[0];
  if (start && !out(start, "next")) err("Connect the Start block to your first message.", start.id);

  if (settings?.trigger_type === "keyword") {
    const kws = settings.keywords ?? [];
    if (kws.length === 0) err("Add at least one keyword that starts this flow, or choose another trigger.");
    const clash = kws.filter((k) => (context.otherKeywords ?? []).includes(k.toLowerCase()));
    if (clash.length) warn(`“${clash[0]}” also starts another automation or flow. Only one of them will answer.`);
    if (kws.some((k) => k.trim().length < 3)) warn("Very short keywords match inside many ordinary words.");
  }

  // ── Per-block checks ──────────────────────────────────────────────────────
  const questionVars = new Map<string, string>();
  const defined = new Set<string>(BUILTIN_VARIABLES);
  for (const n of nodes) {
    if (n.type === "question") {
      const d = n.data as NodeDataMap["question"];
      if (d.variable) defined.add(d.variable);
    }
    if (n.type === "buttons" || n.type === "list") {
      const v = (n.data as NodeDataMap["buttons"]).variable;
      if (v) defined.add(v);
    }
    if (n.type === "location") {
      const v = (n.data as NodeDataMap["location"]).variable;
      if (v) { defined.add(v); defined.add(`${v}_name`); defined.add(`${v}_address`); }
    }
  }

  for (const n of nodes) {
    switch (n.type) {
      case "message": {
        const d = n.data as NodeDataMap["message"];
        if (!d.text?.trim() && !d.imageUrl) err("This message is empty. Write something to send.", n.id);
        if ((d.text ?? "").length > FLOW_LIMITS.textMessage) err(`Messages are limited to ${FLOW_LIMITS.textMessage} characters.`, n.id);
        if (d.imageUrl && !/^https:\/\//i.test(d.imageUrl)) err("The image address must be a public link starting with https://", n.id);
        if (d.imageUrl && (d.text ?? "").length > FLOW_LIMITS.interactiveBody) err(`An image caption is limited to ${FLOW_LIMITS.interactiveBody} characters.`, n.id);
        if (!out(n, "next")) warn("The flow ends after this message. Connect it to another block if it should continue.", n.id);
        break;
      }
      case "buttons": {
        const d = n.data as NodeDataMap["buttons"];
        if (!d.text?.trim()) err("Write the question shown above the buttons.", n.id);
        if ((d.text ?? "").length > FLOW_LIMITS.interactiveBody) err(`The text above buttons is limited to ${FLOW_LIMITS.interactiveBody} characters.`, n.id);
        if (d.buttons.length < 1) err("Add at least one button.", n.id);
        if (d.buttons.length > FLOW_LIMITS.buttons) err(`WhatsApp allows at most ${FLOW_LIMITS.buttons} buttons. Use a Menu for more choices.`, n.id);
        const titles = new Set<string>();
        for (const b of d.buttons) {
          if (!b.title.trim()) err("Every button needs a label.", n.id);
          else if (b.title.length > FLOW_LIMITS.buttonTitle) err(`Button labels are limited to ${FLOW_LIMITS.buttonTitle} characters (“${b.title.slice(0, 18)}…”).`, n.id);
          if (titles.has(b.title.trim().toLowerCase())) err(`Two buttons are both called “${b.title}”.`, n.id);
          titles.add(b.title.trim().toLowerCase());
          if (!out(n, `btn:${b.id}`)) err(`The button “${b.title || "(no label)"}” goes nowhere. Connect it, or add an End block.`, n.id);
        }
        if (d.variable && !VARIABLE_RE.test(d.variable)) err("The answer name can use lowercase letters, numbers and underscores, starting with a letter.", n.id);
        break;
      }
      case "list": {
        const d = n.data as NodeDataMap["list"];
        if (!d.text?.trim()) err("Write the message shown above the menu.", n.id);
        if ((d.text ?? "").length > FLOW_LIMITS.interactiveBody) err(`The text above a menu is limited to ${FLOW_LIMITS.interactiveBody} characters.`, n.id);
        if (!d.buttonLabel?.trim()) err("Give the menu button a label, for example “View options”.", n.id);
        else if (d.buttonLabel.length > FLOW_LIMITS.listButton) err(`The menu button label is limited to ${FLOW_LIMITS.listButton} characters.`, n.id);
        if (d.rows.length < 1) err("Add at least one menu option.", n.id);
        if (d.rows.length > FLOW_LIMITS.listRows) err(`A menu can have at most ${FLOW_LIMITS.listRows} options.`, n.id);
        const titles = new Set<string>();
        for (const r of d.rows) {
          if (!r.title.trim()) err("Every menu option needs a title.", n.id);
          else if (r.title.length > FLOW_LIMITS.listRowTitle) err(`Option titles are limited to ${FLOW_LIMITS.listRowTitle} characters (“${r.title.slice(0, 20)}…”).`, n.id);
          if ((r.description ?? "").length > FLOW_LIMITS.listRowDescription) err(`Option descriptions are limited to ${FLOW_LIMITS.listRowDescription} characters.`, n.id);
          if (titles.has(r.title.trim().toLowerCase())) err(`Two options are both called “${r.title}”.`, n.id);
          titles.add(r.title.trim().toLowerCase());
          if (!out(n, `row:${r.id}`)) err(`The option “${r.title || "(no title)"}” goes nowhere. Connect it, or add an End block.`, n.id);
        }
        break;
      }
      case "question": {
        const d = n.data as NodeDataMap["question"];
        if (!d.text?.trim()) err("Write the question to ask.", n.id);
        if ((d.text ?? "").length > FLOW_LIMITS.textMessage) err(`Questions are limited to ${FLOW_LIMITS.textMessage} characters.`, n.id);
        if (!d.variable?.trim()) err("Name the answer so you can use it later, for example “email”.", n.id);
        else if (!VARIABLE_RE.test(d.variable)) err("The answer name can use lowercase letters, numbers and underscores, starting with a letter.", n.id);
        else if (BUILTIN_VARIABLES.includes(d.variable)) err(`“${d.variable}” is already used by ReplyKaro. Pick another name.`, n.id);
        else if (questionVars.has(d.variable)) err(`Two questions save their answer as “${d.variable}”. Give each its own name.`, n.id);
        else questionVars.set(d.variable, n.id);
        if (!out(n, "next")) warn("The flow ends after this question. Connect it to the next block.", n.id);
        break;
      }
      case "location": {
        const d = n.data as NodeDataMap["location"];
        if (!d.text?.trim()) err("Write the message that asks for the location.", n.id);
        if (!d.variable?.trim() || !VARIABLE_RE.test(d.variable)) err("Name the location answer, for example “location”.", n.id);
        if ((d.text ?? "").length > FLOW_LIMITS.interactiveBody) err(`The location request is limited to ${FLOW_LIMITS.interactiveBody} characters.`, n.id);
        break;
      }
      case "condition": {
        const d = n.data as NodeDataMap["condition"];
        if (!d.variable?.trim()) err("Choose which answer to check.", n.id);
        else if (!defined.has(d.variable)) warn(`“${d.variable}” is never collected in this flow, so this check will always use the “no” path.`, n.id);
        if ((d.op === "equals" || d.op === "contains") && !(d.value ?? "").trim()) err("Enter the value to compare with.", n.id);
        if (!out(n, "yes")) err("Connect the “yes” path.", n.id);
        if (!out(n, "no")) err("Connect the “no” path.", n.id);
        break;
      }
      case "wait": {
        const d = n.data as NodeDataMap["wait"];
        if (!(d.seconds >= 1)) err("Set how long to wait (at least 1 second).", n.id);
        if (d.seconds > FLOW_LIMITS.maxWaitSeconds) err("WhatsApp only allows messages within 24 hours of the customer's last message, so waits are limited to 23 hours.", n.id);
        if (!out(n, "next")) warn("Nothing comes after this wait, so it does nothing. Connect it or remove it.", n.id);
        break;
      }
      case "tag":
        if (!(n.data as NodeDataMap["tag"]).label?.trim()) err("Enter the label to add to the contact.", n.id);
        break;
      case "lead":
        break;
      case "handoff":
        if (!(n.data as NodeDataMap["handoff"]).text?.trim()) warn("Tell the customer a person will reply, so they know what to expect.", n.id);
        break;
      case "end":
        break;
    }

    // Variables used in texts must be collected somewhere in the flow.
    const text = n.type === "message" ? (n.data as NodeDataMap["message"]).text
      : n.type === "buttons" || n.type === "list" || n.type === "question" || n.type === "location" ? (n.data as any).text
      : n.type === "handoff" || n.type === "end" ? (n.data as any).text : "";
    for (const v of new Set(used(text))) {
      if (!defined.has(v)) warn(`“{{${v}}}” is not collected anywhere in this flow, so it will show as empty.`, n.id);
    }
  }

  // ── Graph checks ──────────────────────────────────────────────────────────
  const reachable = new Set<string>();
  if (start) {
    const stack = [start.id];
    while (stack.length) {
      const id = stack.pop()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      for (const e of edges) if (e.source === id) stack.push(e.target);
    }
    for (const n of nodes) if (!reachable.has(n.id) && n.type !== "start") warn(`This ${label(n).toLowerCase()} block is not connected to the Start, so no customer will ever reach it.`, n.id);
  }

  // A loop made only of blocks that never wait for the customer would repeat forever.
  const free = new Set(nodes.filter((n) => !isInputNode(n.type) && n.type !== "wait" && n.type !== "handoff" && n.type !== "end").map((n) => n.id));
  const color = new Map<string, 1 | 2>();
  const loopAt = (id: string): string | null => {
    color.set(id, 1);
    for (const e of edges) {
      if (e.source !== id || !free.has(e.target)) continue;
      const c = color.get(e.target);
      if (c === 1) return e.target;
      if (!c) { const hit = loopAt(e.target); if (hit) return hit; }
    }
    color.set(id, 2);
    return null;
  };
  for (const id of free) {
    if (color.has(id)) continue;
    const hit = loopAt(id);
    if (hit) { err("These blocks loop back to each other without ever waiting for the customer, so they would repeat instantly. Add a question, buttons or a wait inside the loop.", hit); break; }
  }

  // Waits between customer replies add up: free-form messages must start within 24 hours of the last reply.
  const segmentStarts = [start?.id, ...nodes.filter((n) => isInputNode(n.type)).flatMap((n) => outputHandles(n).map((h) => out(n, h)))].filter(Boolean) as string[];
  const reported = new Set<string>();
  for (const s of segmentStarts) {
    const longest = (id: string, seen: Set<string>): number => {
      const n = byId.get(id);
      if (!n || seen.has(id) || isInputNode(n.type)) return 0;
      const here = n.type === "wait" ? Number((n.data as NodeDataMap["wait"]).seconds) || 0 : 0;
      const next = outputHandles(n).map((h) => out(n, h)).filter(Boolean) as string[];
      const s2 = new Set(seen).add(id);
      return here + Math.max(0, ...next.map((t) => longest(t, s2)));
    };
    if (longest(s, new Set()) > FLOW_LIMITS.maxWaitSeconds && !reported.has(s)) {
      reported.add(s);
      err("The waits on this path add up to more than 23 hours without the customer replying. WhatsApp would refuse the messages after that. Shorten the waits or ask the customer something in between.", s);
    }
  }

  // Collecting details is a promise to handle them carefully.
  const hasLead = nodes.some((n) => n.type === "lead");
  const asksPersonal = nodes.some((n) => n.type === "question" && ["email", "phone", "name"].includes((n.data as NodeDataMap["question"]).input));
  // A lead always holds the customer's WhatsApp number; it is only empty of detail when nothing is asked.
  const asksAnything = nodes.some((n) => ["question", "buttons", "list", "location"].includes(n.type));
  if (hasLead && !asksAnything) warn("You save a lead but never ask anything, so it will hold only the phone number. Add a question first.");
  if (asksPersonal && !nodes.some((n) => n.type === "lead")) warn("You collect personal details but never save them as a lead, so they are only used inside this flow.");
  return issues;
}

export const hasErrors = (issues: FlowIssue[]) => issues.some((i) => i.level === "error");
