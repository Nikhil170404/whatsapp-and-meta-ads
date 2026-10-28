/**
 * Conversation flows: a graph of blocks the customer walks through on WhatsApp.
 * The same model is used by the canvas editor, the in-browser preview and the live runtime.
 */
export type NodeType =
  | "start" | "message" | "buttons" | "list" | "question" | "location"
  | "condition" | "wait" | "tag" | "lead" | "handoff" | "end" | "pay";

export interface FlowButton { id: string; title: string }
export interface FlowRow { id: string; title: string; description?: string }
export type InputKind = "text" | "name" | "email" | "phone" | "number";
export type ConditionOp = "equals" | "contains" | "exists" | "not_exists";

export interface NodeDataMap {
  start: { label?: string };
  message: { text: string; imageUrl?: string };
  buttons: { text: string; buttons: FlowButton[]; variable?: string; maxRetries?: number };
  list: { text: string; buttonLabel: string; rows: FlowRow[]; variable?: string; maxRetries?: number };
  question: { text: string; variable: string; input: InputKind; retryText?: string; maxRetries?: number; skippable?: boolean };
  location: { text: string; variable: string; maxRetries?: number };
  condition: { variable: string; op: ConditionOp; value?: string };
  wait: { seconds: number };
  tag: { label: string };
  lead: { note?: string };
  handoff: { text: string; note?: string };
  end: { text?: string };
  /** A message with a button that opens the business's own payment page (any gateway, UPI or Razorpay link). */
  pay: { text: string; url: string; buttonLabel: string };
}

export interface FlowNode<T extends NodeType = NodeType> {
  id: string;
  type: T;
  position: { x: number; y: number };
  data: NodeDataMap[T];
}

/** sourceHandle: "next" | "yes" | "no" | "giveup" | "btn:<buttonId>" | "row:<rowId>" */
export interface FlowEdge { id: string; source: string; sourceHandle: string; target: string }

export interface FlowDefinition { nodes: FlowNode[]; edges: FlowEdge[] }

export interface FlowSettings {
  trigger_type: "keyword" | "welcome" | "any";
  keywords: string[];
  /** Words that end a running flow at any time. */
  exit_keywords: string[];
}

export const DEFAULT_EXIT_KEYWORDS = ["cancel", "exit", "quit"];

/** What a block needs from the customer before the flow can move on. */
export const INPUT_NODES: NodeType[] = ["buttons", "list", "question", "location"];
export const isInputNode = (t: NodeType) => INPUT_NODES.includes(t);

/** Limits from Meta's documentation (interactive messages) and WhatsApp text messages. */
export const FLOW_LIMITS = {
  textMessage: 4096,
  interactiveBody: 1024,
  buttons: 3,
  buttonTitle: 20,
  listRows: 10,
  listRowTitle: 24,
  listRowDescription: 72,
  listButton: 20,
  /** Free-form messages are only allowed within 24 hours of the customer's last message. */
  maxWaitSeconds: 23 * 60 * 60,
  maxRetries: 5,
} as const;

/** The connection points a block exposes. */
export function outputHandles(node: FlowNode): string[] {
  switch (node.type) {
    case "start": case "message": case "tag": case "lead": case "wait": case "pay": return ["next"];
    case "question": case "location": return ["next", "giveup"];
    case "buttons": return [...(node.data as NodeDataMap["buttons"]).buttons.map((b) => `btn:${b.id}`), "giveup"];
    case "list": return [...(node.data as NodeDataMap["list"]).rows.map((r) => `row:${r.id}`), "giveup"];
    case "condition": return ["yes", "no"];
    default: return [];
  }
}

export const VARIABLE_RE = /^[a-z][a-z0-9_]{0,29}$/;
export const BUILTIN_VARIABLES = ["contact_name", "phone"];
