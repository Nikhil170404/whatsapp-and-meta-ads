import {
  CreditCard, Flag, Webhook, GitBranch, Headset, ListChecks, MapPin, MessageCircleQuestion, MessageSquare, MousePointerClick, Play, Tag, Timer, UserPlus,
  type LucideIcon,
} from "lucide-react";
import type { FlowNode, NodeDataMap, NodeType } from "@/lib/flows/types";

export interface NodeMeta {
  label: string;
  /** One sentence shown in the block picker. */
  help: string;
  icon: LucideIcon;
  /** Tailwind classes: header tint, icon chip, ring colour when selected. */
  tint: string;
  chip: string;
  ring: string;
  group: "Talk" | "Ask" | "Logic" | "Act";
  defaults: () => NodeDataMap[NodeType];
}

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;

export const NODE_META: Record<NodeType, NodeMeta> = {
  start: { label: "Start", help: "Where every conversation begins.", icon: Play, tint: "bg-emerald-50", chip: "bg-emerald-500 text-white", ring: "ring-emerald-400", group: "Talk", defaults: () => ({}) },
  message: { label: "Message", help: "Send a text, with an optional picture.", icon: MessageSquare, tint: "bg-sky-50", chip: "bg-sky-500 text-white", ring: "ring-sky-400", group: "Talk", defaults: () => ({ text: "" }) },
  buttons: { label: "Buttons", help: "Offer up to 3 tap-to-answer buttons.", icon: MousePointerClick, tint: "bg-violet-50", chip: "bg-violet-500 text-white", ring: "ring-violet-400", group: "Ask", defaults: () => ({ text: "", buttons: [{ id: uid("b"), title: "Yes" }, { id: uid("b"), title: "No" }], maxRetries: 2 }) },
  list: { label: "Menu", help: "A list of up to 10 choices to pick from.", icon: ListChecks, tint: "bg-indigo-50", chip: "bg-indigo-500 text-white", ring: "ring-indigo-400", group: "Ask", defaults: () => ({ text: "", buttonLabel: "View options", rows: [{ id: uid("r"), title: "Option 1" }, { id: uid("r"), title: "Option 2" }], maxRetries: 2 }) },
  question: { label: "Question", help: "Ask for a name, email, phone or any answer, and check it.", icon: MessageCircleQuestion, tint: "bg-amber-50", chip: "bg-amber-500 text-white", ring: "ring-amber-400", group: "Ask", defaults: () => ({ text: "", variable: "", input: "text", maxRetries: 2 }) },
  location: { label: "Location", help: "Ask the customer to share their location.", icon: MapPin, tint: "bg-rose-50", chip: "bg-rose-500 text-white", ring: "ring-rose-400", group: "Ask", defaults: () => ({ text: "Please share your location so we can help.", variable: "location", maxRetries: 2 }) },
  condition: { label: "Condition", help: "Take a different path depending on an answer.", icon: GitBranch, tint: "bg-orange-50", chip: "bg-orange-500 text-white", ring: "ring-orange-400", group: "Logic", defaults: () => ({ variable: "", op: "equals", value: "" }) },
  wait: { label: "Wait", help: "Pause before the next message (up to 23 hours).", icon: Timer, tint: "bg-slate-100", chip: "bg-slate-600 text-white", ring: "ring-slate-400", group: "Logic", defaults: () => ({ seconds: 60 }) },
  tag: { label: "Add label", help: "Label the contact, for example “interested”.", icon: Tag, tint: "bg-teal-50", chip: "bg-teal-500 text-white", ring: "ring-teal-400", group: "Act", defaults: () => ({ label: "" }) },
  lead: { label: "Save lead", help: "Store everything collected so far as a lead.", icon: UserPlus, tint: "bg-green-50", chip: "bg-green-600 text-white", ring: "ring-green-400", group: "Act", defaults: () => ({ note: "" }) },
  handoff: { label: "Hand to a person", help: "Stop the bot and flag the chat for your team.", icon: Headset, tint: "bg-pink-50", chip: "bg-pink-500 text-white", ring: "ring-pink-400", group: "Act", defaults: () => ({ text: "Thanks! A team member will reply here shortly." }) },
  pay: { label: "Payment link", help: "Send a button that opens your payment page, so customers can pay in two taps.", icon: CreditCard, tint: "bg-lime-50", chip: "bg-lime-600 text-white", ring: "ring-lime-400", group: "Act", defaults: () => ({ text: "Your total is ₹499. Tap the button to pay securely.", url: "", buttonLabel: "Pay now" }) },
  webhook: { label: "Send to a URL", help: "Send the details collected so far to your own system, like Google Sheets, a CRM, Zapier or Make.", icon: Webhook, tint: "bg-cyan-50", chip: "bg-cyan-600 text-white", ring: "ring-cyan-400", group: "Act", defaults: () => ({ url: "" }) },
  end: { label: "End", help: "Finish the conversation.", icon: Flag, tint: "bg-slate-100", chip: "bg-slate-700 text-white", ring: "ring-slate-400", group: "Act", defaults: () => ({ text: "" }) },
};

export const PALETTE: NodeType[] = ["message", "buttons", "list", "question", "location", "condition", "wait", "tag", "lead", "handoff", "pay", "webhook", "end"];

export function newNode(type: NodeType, position: { x: number; y: number }): FlowNode {
  return { id: uid(type.slice(0, 3)), type, position, data: NODE_META[type].defaults() } as FlowNode;
}

export function humanWait(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;
  if (s < 3600) { const m = Math.round(s / 60); return `${m} minute${m === 1 ? "" : "s"}`; }
  const h = Math.round((s / 3600) * 10) / 10;
  return `${h} hour${h === 1 ? "" : "s"}`;
}

/** A short line describing what a block does, for the card on the canvas. */
export function summary(node: FlowNode): string {
  const d = node.data as any;
  switch (node.type) {
    case "start": return "Conversation begins here";
    case "message": return d.text?.trim() || (d.imageUrl ? "Picture" : "Write your message…");
    case "buttons": return d.text?.trim() || "Ask a question…";
    case "list": return d.text?.trim() || "Offer a menu…";
    case "question": return d.text?.trim() || "Ask a question…";
    case "location": return d.text?.trim() || "Ask for a location…";
    case "condition": return d.variable ? `If ${d.variable} ${d.op === "equals" ? "is" : d.op === "contains" ? "contains" : d.op === "exists" ? "is filled in" : "is empty"}${d.value && d.op !== "exists" && d.op !== "not_exists" ? ` “${d.value}”` : ""}` : "Choose what to check…";
    case "wait": return `Wait ${humanWait(d.seconds || 0)}`;
    case "tag": return d.label?.trim() ? `Add label “${d.label}”` : "Choose a label…";
    case "lead": return "Save the details collected so far";
    case "handoff": return d.text?.trim() || "Hand over to your team";
    case "end": return d.text?.trim() || "Conversation ends";
    case "webhook": return d.url?.trim() ? `Send details to ${d.url.replace(/^https?:\/\//, "").slice(0, 30)}` : "Paste the address to send to…";
    case "pay": return d.url?.trim() ? `${d.buttonLabel || "Pay"} → ${d.url.replace(/^https?:\/\//, "").slice(0, 28)}` : "Paste your payment link…";
  }
}
