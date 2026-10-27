/**
 * Conversation-flow helpers shared by the webhook and tests.
 *
 * A "flow" is a chain of automations: a menu (buttons or list) whose options
 * are keywords for the next automations. When a customer taps an option, Meta
 * sends the option's id and title; we treat the title (and id) as the text the
 * customer "said", so the next automation fires like any keyword match.
 */

export interface InboundText {
  /** What the customer said or tapped, as plain text. */
  text: string;
  /** The id of the tapped button or list row, when the message was a tap. */
  replyId?: string;
  /** True when the customer tapped an option instead of typing. */
  isTap: boolean;
}

export function extractInboundText(message: any): InboundText | null {
  switch (message?.type) {
    case "text":
      return { text: String(message.text?.body ?? ""), isTap: false };
    case "interactive": {
      const reply = message.interactive?.button_reply ?? message.interactive?.list_reply;
      if (!reply) return null;
      return { text: String(reply.title ?? ""), replyId: reply.id ? String(reply.id) : undefined, isTap: true };
    }
    case "button": // quick-reply tap on a template message
      return { text: String(message.button?.text ?? message.button?.payload ?? ""), isTap: true };
    default:
      return null;
  }
}

export interface AutomationRule {
  trigger_type: string; // "keyword" | "any" | "welcome"
  trigger_keyword?: string | null;
}

/**
 * Chooses the single automation that should answer a message.
 * Priority: exact keyword > keyword contained in the text (longest keyword first)
 * > welcome (first message only) > any message. Without this order an "any"
 * automation created first would answer everything and hide the keyword ones.
 */
export function pickAutomation<T extends AutomationRule>(
  automations: T[],
  inbound: Pick<InboundText, "text" | "replyId">,
  isFirstMessage: boolean
): T | undefined {
  const said = inbound.text.trim().toLowerCase();
  const id = inbound.replyId?.trim().toLowerCase();

  const keywordRules = automations
    .filter((a) => a.trigger_type === "keyword" && a.trigger_keyword?.trim())
    .map((a) => ({ a, kw: a.trigger_keyword!.trim().toLowerCase() }));

  const exact = keywordRules.find(({ kw }) => kw === said || (id !== undefined && kw === id));
  if (exact) return exact.a;

  const contained = keywordRules
    .filter(({ kw }) => said.includes(kw))
    .sort((x, y) => y.kw.length - x.kw.length)[0];
  if (contained) return contained.a;

  if (isFirstMessage) {
    const welcome = automations.find((a) => a.trigger_type === "welcome");
    if (welcome) return welcome;
  }

  return automations.find((a) => a.trigger_type === "any");
}

// ── Meta limits for interactive messages ─────────────────────────────────────

export interface ListRow {
  id: string;
  title: string; // max 24
  description?: string; // max 72
}

export interface ListOptions {
  list_button: string; // max 20
  rows: ListRow[]; // 1..10
}

export const LIMITS = {
  buttons: 3,
  buttonTitle: 20,
  listRows: 10,
  listRowTitle: 24,
  listRowDescription: 72,
  listButton: 20,
  interactiveBody: 1024,
} as const;

export function slugifyId(title: string, fallback: string): string {
  const s = title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return (s || fallback).slice(0, 60);
}

/** Returns an error message when the options break Meta's limits, else null. */
export function validateListOptions(opts: any, body: string | null | undefined): string | null {
  if (!body?.trim()) return "Add the message text shown above the menu.";
  if (body.length > LIMITS.interactiveBody) return `Message text is limited to ${LIMITS.interactiveBody} characters.`;
  if (!opts?.list_button?.trim()) return "Add a label for the menu button (for example “View options”).";
  if (opts.list_button.length > LIMITS.listButton) return `Menu button label is limited to ${LIMITS.listButton} characters.`;
  const rows: ListRow[] = Array.isArray(opts.rows) ? opts.rows : [];
  if (rows.length < 1) return "Add at least one menu option.";
  if (rows.length > LIMITS.listRows) return `A menu can have at most ${LIMITS.listRows} options.`;
  const seen = new Set<string>();
  for (const r of rows) {
    if (!r.title?.trim()) return "Every menu option needs a title.";
    if (r.title.length > LIMITS.listRowTitle) return `Option titles are limited to ${LIMITS.listRowTitle} characters (“${r.title.slice(0, 20)}…”).`;
    if ((r.description ?? "").length > LIMITS.listRowDescription) return `Option descriptions are limited to ${LIMITS.listRowDescription} characters.`;
    if (!r.id?.trim()) return "Every menu option needs an id.";
    if (seen.has(r.id)) return "Two menu options share the same id.";
    seen.add(r.id);
  }
  return null;
}

// ── Flow checker ─────────────────────────────────────────────────────────────

export interface CheckableAutomation {
  id: string;
  name: string;
  is_active: boolean;
  trigger_type: string;
  trigger_keyword?: string | null;
  message_type?: string | null;
  button_options?: { buttons?: { title: string; id?: string }[]; rows?: { title: string; id?: string }[] } | null;
}

export interface FlowIssue {
  level: "error" | "warning";
  message: string;
  /** Offered as a one-click fix in the UI. */
  createKeyword?: string;
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/**
 * Finds mistakes in a user's automations that would otherwise only show up
 * when a customer taps something and nothing happens.
 */
export function analyzeFlows(automations: CheckableAutomation[]): FlowIssue[] {
  const issues: FlowIssue[] = [];
  const active = automations.filter((a) => a.is_active);

  // Every option of every active menu needs a keyword automation behind it.
  const keywordRules = active.filter((a) => a.trigger_type === "keyword" && norm(a.trigger_keyword));
  // An option is answered when a keyword equals its id (exact) or appears in its title.
  const answered = (title: string, id?: string) => {
    const t = norm(title);
    const i = norm(id);
    return keywordRules.some((a) => {
      const k = norm(a.trigger_keyword);
      return k === t || (!!i && k === i) || t.includes(k);
    });
  };
  const reported = new Set<string>();
  for (const a of active) {
    const options =
      a.message_type === "list" ? a.button_options?.rows ?? [] :
      a.message_type === "buttons" ? a.button_options?.buttons ?? [] : [];
    for (const o of options) {
      const t = norm(o.title);
      if (!t || answered(o.title, o.id) || reported.has(t)) continue;
      reported.add(t);
      issues.push({
        level: "error",
        message: `In “${a.name}”, tapping “${o.title}” does nothing yet. Add an automation with the keyword “${o.title}”.`,
        createKeyword: o.title,
      });
    }
  }

  // Two active automations with the same keyword: only one can answer.
  const byKeyword = new Map<string, CheckableAutomation[]>();
  for (const a of keywordRules) {
    const k = norm(a.trigger_keyword);
    byKeyword.set(k, [...(byKeyword.get(k) ?? []), a]);
  }
  for (const [k, list] of byKeyword) {
    if (list.length > 1) {
      issues.push({ level: "warning", message: `${list.length} automations use the keyword “${k}” (${list.map((a) => a.name).join(", ")}). Only the first one will reply.` });
    }
  }

  const anyRules = active.filter((a) => a.trigger_type === "any");
  if (anyRules.length > 1) issues.push({ level: "warning", message: `You have ${anyRules.length} “any message” automations. Only one can reply, so turn the others off.` });
  const welcomeRules = active.filter((a) => a.trigger_type === "welcome");
  if (welcomeRules.length > 1) issues.push({ level: "warning", message: `You have ${welcomeRules.length} welcome automations. Only one will reply to new customers.` });
  if (anyRules.length === 1 && keywordRules.length > 0) {
    issues.push({ level: "warning", message: `“${anyRules[0].name}” replies to any message that does not match a keyword. Customers who type something unexpected will get this reply every time.` });
  }

  // A keyword that is too short matches inside many words.
  for (const a of keywordRules) {
    if (norm(a.trigger_keyword).length < 3) {
      issues.push({ level: "warning", message: `The keyword “${a.trigger_keyword}” in “${a.name}” is very short and will match inside many ordinary words.` });
    }
  }

  return issues;
}

/**
 * A readable line for the inbox when a customer sends something other than
 * plain text, so media and locations are never shown as "[image message]".
 */
export function describeInbound(message: any): string {
  const cap = (c?: string) => (c?.trim() ? `: ${c.trim()}` : "");
  switch (message?.type) {
    case "text": return String(message.text?.body ?? "");
    case "image": return `📷 Photo${cap(message.image?.caption)}`;
    case "video": return `🎥 Video${cap(message.video?.caption)}`;
    case "audio": return message.audio?.voice ? "🎤 Voice message" : "🎧 Audio";
    case "document": return `📄 Document${cap(message.document?.filename ?? message.document?.caption)}`;
    case "sticker": return "Sticker";
    case "location": {
      const l = message.location ?? {};
      const place = [l.name, l.address].filter(Boolean).join(", ");
      return `📍 Location${place ? `: ${place}` : l.latitude != null ? `: ${l.latitude}, ${l.longitude}` : ""}`;
    }
    case "contacts": return `👤 Shared ${message.contacts?.length ?? 1} contact(s)`;
    case "reaction": return `Reacted ${message.reaction?.emoji ?? ""}`.trim();
    case "order": return "🛒 Sent an order";
    case "interactive": {
      const r = message.interactive?.button_reply ?? message.interactive?.list_reply;
      if (r?.title) return String(r.title);
      return message.interactive?.nfm_reply ? "Submitted a form" : "Interactive reply";
    }
    case "button": return String(message.button?.text ?? "Button reply");
    case "system": return "";
    default: return `[${message?.type ?? "unknown"} message]`;
  }
}
