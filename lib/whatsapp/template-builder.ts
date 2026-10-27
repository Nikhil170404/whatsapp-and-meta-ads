/**
 * Builds and checks WhatsApp message templates before they are sent to Meta,
 * so users find mistakes while typing instead of from a rejection a day later.
 *
 * Scope is deliberately the set that needs no values at send time other than
 * body variables: optional text header, body, optional footer, and quick-reply,
 * URL (fixed address) or phone buttons. Authentication (OTP) templates follow
 * Meta's fixed format.
 */

export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";

export type TemplateButton =
  | { type: "QUICK_REPLY"; text: string }
  | { type: "URL"; text: string; url: string }
  | { type: "PHONE_NUMBER"; text: string; phone_number: string };

export interface TemplateInput {
  name: string;
  category: TemplateCategory;
  language: string;
  header_text?: string;
  body_text: string;
  footer_text?: string;
  buttons?: TemplateButton[];
  /** One example value per body variable, in order. Meta requires them. */
  examples?: string[];
}

export interface Issue {
  level: "error" | "warning";
  field: "name" | "header" | "body" | "footer" | "buttons" | "examples";
  message: string;
  /** Present when applyFix can resolve the issue automatically. */
  fix?: "wrap_start" | "wrap_end" | "renumber";
}

export const TEMPLATE_LIMITS = {
  name: 512,
  header: 60,
  body: 1024,
  footer: 60,
  buttonText: 25,
  quickReplies: 3,
  buttons: 10,
  url: 2000,
  expiryMin: 1,
  expiryMax: 90,
} as const;

const VAR_RE = /\{\{(\d+)\}\}/g;

export function bodyVariables(text: string): number[] {
  return [...text.matchAll(VAR_RE)].map((m) => Number(m[1]));
}

/** Lowercase letters, digits and underscores, as Meta requires. */
export function toMetaName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, TEMPLATE_LIMITS.name);
}

export function defaultExamples(body: string): string[] {
  const count = new Set(bodyVariables(body)).size;
  const samples = ["Rahul", "12345", "Pune", "499", "Friday", "10%", "Standard", "9:00 AM"];
  return Array.from({ length: count }, (_, i) => samples[i % samples.length]);
}

export function validateTemplate(t: TemplateInput): Issue[] {
  const issues: Issue[] = [];
  const err = (field: Issue["field"], message: string, fix?: Issue["fix"]) => issues.push({ level: "error", field, message, fix });
  const warn = (field: Issue["field"], message: string) => issues.push({ level: "warning", field, message });

  if (!toMetaName(t.name)) err("name", "Give the template a name.");

  if (t.category === "AUTHENTICATION") return issues; // fixed Meta format, nothing else to check

  const body = t.body_text ?? "";
  if (!body.trim()) err("body", "Write the message text.");
  if (body.length > TEMPLATE_LIMITS.body) err("body", `The message is ${body.length} characters; the limit is ${TEMPLATE_LIMITS.body}.`);

  const vars = bodyVariables(body);
  const unique = [...new Set(vars)].sort((a, b) => a - b);
  if (unique.some((n, i) => n !== i + 1)) {
    err("body", "Variables must be numbered in order: {{1}}, {{2}}, {{3}} with no gaps.", "renumber");
  }
  const trimmed = body.trim();
  if (/^\{\{\d+\}\}/.test(trimmed)) {
    err("body", "The message cannot start with a variable. Meta rejects this.", "wrap_start");
  }
  if (/\{\{\d+\}\}[^\p{L}\p{N}]*$/u.test(trimmed) && /\{\{\d+\}\}\s*$/.test(trimmed)) {
    err("body", "The message cannot end with a variable. Meta rejects this.", "wrap_end");
  }
  if (/\{\{\d+\}\}\s*\{\{\d+\}\}/.test(body)) {
    err("body", "Two variables cannot sit next to each other. Put words between them.");
  }
  if (/\n{3,}/.test(body)) warn("body", "Meta rejects more than two line breaks in a row.");
  if (/ {5,}/.test(body)) warn("body", "Meta rejects five or more spaces in a row.");
  const words = body.replace(VAR_RE, "").split(/\s+/).filter(Boolean).length;
  if (unique.length > 0 && words < unique.length * 3) {
    warn("body", "Add more text around your variables. Meta often rejects messages that are mostly variables.");
  }

  const examples = t.examples ?? [];
  if (unique.length > 0) {
    if (examples.length < unique.length || examples.slice(0, unique.length).some((e) => !e?.trim())) {
      err("examples", "Add a sample value for every variable. Meta uses them to review your template.");
    }
  }

  if (t.header_text) {
    if (t.header_text.length > TEMPLATE_LIMITS.header) err("header", `The header is limited to ${TEMPLATE_LIMITS.header} characters.`);
    if (bodyVariables(t.header_text).length > 0) err("header", "Variables in the header are not supported here. Put them in the message text.");
    if (/[\n*_~]/.test(t.header_text)) err("header", "The header cannot contain line breaks or formatting.");
  }

  if (t.footer_text) {
    if (t.footer_text.length > TEMPLATE_LIMITS.footer) err("footer", `The footer is limited to ${TEMPLATE_LIMITS.footer} characters.`);
    if (bodyVariables(t.footer_text).length > 0) err("footer", "Footers cannot contain variables.");
  }

  const buttons = t.buttons ?? [];
  if (buttons.length > TEMPLATE_LIMITS.buttons) err("buttons", `At most ${TEMPLATE_LIMITS.buttons} buttons.`);
  if (buttons.filter((b) => b.type === "QUICK_REPLY").length > TEMPLATE_LIMITS.quickReplies) {
    err("buttons", `At most ${TEMPLATE_LIMITS.quickReplies} quick-reply buttons.`);
  }
  if (buttons.filter((b) => b.type === "URL").length > 2) err("buttons", "At most 2 link buttons.");
  if (buttons.filter((b) => b.type === "PHONE_NUMBER").length > 1) err("buttons", "At most 1 call button.");
  const labels = new Set<string>();
  for (const b of buttons) {
    if (!b.text?.trim()) err("buttons", "Every button needs a label.");
    else if (b.text.length > TEMPLATE_LIMITS.buttonText) err("buttons", `Button labels are limited to ${TEMPLATE_LIMITS.buttonText} characters.`);
    if (labels.has(b.text?.toLowerCase())) err("buttons", `Two buttons are both called “${b.text}”.`);
    labels.add(b.text?.toLowerCase());
    if (b.type === "URL") {
      if (!/^https:\/\/[^\s{}]+\.[^\s{}]+/i.test(b.url ?? "")) err("buttons", `“${b.text || "Link"}” needs a full web address starting with https://`);
    }
    if (b.type === "PHONE_NUMBER" && !/^\+\d{7,15}$/.test(b.phone_number ?? "")) {
      err("buttons", `“${b.text || "Call"}” needs a phone number with country code, like +919876543210.`);
    }
  }

  if (t.category === "MARKETING" && !/stop|opt.?out|unsubscribe/i.test(body + " " + (t.footer_text ?? "")) &&
      !buttons.some((b) => b.type === "QUICK_REPLY" && /stop|unsubscribe|opt/i.test(b.text))) {
    warn("footer", "Add an opt-out line such as “Reply STOP to unsubscribe” in the footer. It keeps your quality rating high.");
  }

  return issues;
}

export function applyFix(body: string, fix: NonNullable<Issue["fix"]>): string {
  if (fix === "wrap_start") return `Hello, ${body.trimStart()}`;
  if (fix === "wrap_end") return `${body.trimEnd()}\n\nThank you.`;
  // renumber: map the variables in order of first appearance to 1..n
  const map = new Map<string, number>();
  return body.replace(VAR_RE, (_m, n) => {
    if (!map.has(n)) map.set(n, map.size + 1);
    return `{{${map.get(n)}}}`;
  });
}

/** Meta components for a standard (marketing / utility) template. */
export function buildMetaComponents(t: TemplateInput): Record<string, unknown>[] {
  const components: Record<string, unknown>[] = [];
  const header = t.header_text?.trim();
  if (header) components.push({ type: "HEADER", format: "TEXT", text: header });

  const body: Record<string, unknown> = { type: "BODY", text: t.body_text };
  const count = new Set(bodyVariables(t.body_text)).size;
  if (count > 0) body.example = { body_text: [(t.examples ?? defaultExamples(t.body_text)).slice(0, count)] };
  components.push(body);

  const footer = t.footer_text?.trim();
  if (footer) components.push({ type: "FOOTER", text: footer });

  if (t.buttons?.length) {
    components.push({
      type: "BUTTONS",
      buttons: t.buttons.map((b) =>
        b.type === "URL"
          ? { type: "URL", text: b.text, url: b.url }
          : b.type === "PHONE_NUMBER"
          ? { type: "PHONE_NUMBER", text: b.text, phone_number: b.phone_number }
          : { type: "QUICK_REPLY", text: b.text }
      ),
    });
  }
  return components;
}

export interface AuthTemplateOptions {
  expiry_minutes?: number;
  add_security_recommendation?: boolean;
}

/** Meta's fixed authentication (OTP) format with a copy-code button. */
export function buildAuthComponents(opts: AuthTemplateOptions = {}): Record<string, unknown>[] {
  const expiry = Math.min(TEMPLATE_LIMITS.expiryMax, Math.max(TEMPLATE_LIMITS.expiryMin, Math.round(opts.expiry_minutes ?? 10)));
  return [
    { type: "BODY", add_security_recommendation: opts.add_security_recommendation ?? true },
    { type: "FOOTER", code_expiration_minutes: expiry },
    { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE" }] },
  ];
}

/** Message components to send an authentication template with a one-time code. */
export function buildOtpSendComponents(code: string): Record<string, unknown>[] {
  return [
    { type: "body", parameters: [{ type: "text", text: code }] },
    { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
  ];
}

export function isValidOtpCode(code: unknown): code is string {
  return typeof code === "string" && /^[A-Za-z0-9]{4,15}$/.test(code);
}

// ── Sending: map each body variable to a value ───────────────────────────────

export type VariableSource =
  | { source: "name" }
  | { source: "phone" }
  | { source: "text"; value: string };

/** Default plan: variable 1 is the contact's name, the rest are typed by the user. */
export function defaultVariablePlan(body: string): VariableSource[] {
  const count = new Set(bodyVariables(body)).size;
  return Array.from({ length: count }, (_, i) => (i === 0 ? { source: "name" } : { source: "text", value: "" }));
}

export function validateVariablePlan(body: string, plan: VariableSource[] | undefined): string | null {
  const count = new Set(bodyVariables(body)).size;
  if (count === 0) return null;
  if (!plan || plan.length < count) return "Choose a value for every variable in the message.";
  for (let i = 0; i < count; i++) {
    const p = plan[i];
    if (p.source === "text" && !p.value.trim()) return `Fill in a value for variable {{${i + 1}}}.`;
  }
  return null;
}

/** Body parameters for one recipient. Meta rejects empty values, so fall back to a safe word. */
export function resolveBodyParameters(
  body: string,
  plan: VariableSource[] | undefined,
  contact: { name?: string | null; phone: string }
): string[] {
  const count = new Set(bodyVariables(body)).size;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const p = plan?.[i] ?? (i === 0 ? ({ source: "name" } as const) : ({ source: "text", value: "" } as const));
    let v = p.source === "name" ? contact.name?.trim() || "there" : p.source === "phone" ? contact.phone : p.value.trim();
    // Meta forbids newlines, tabs and 4+ spaces inside parameter values.
    v = v.replace(/[\n\t]+/g, " ").replace(/ {4,}/g, "   ");
    out.push(v || "-");
  }
  return out;
}
