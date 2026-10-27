/**
 * Operations shared by the dashboard, the REST API and the MCP server, so a rule
 * (plan limits, consent, template validation) is written once. Each operation
 * takes a service-role Supabase client and the owning user's id, and returns a
 * result instead of throwing, so callers choose how to present failures.
 */
import { PRICING_PLANS } from "@/lib/pricing";
import { hasMarketingConsent, recordConsent, type ConsentPurpose } from "@/lib/consent";
import { validateListOptions } from "@/lib/whatsapp/flow";
import {
  buildAuthComponents, buildMetaComponents, defaultExamples, toMetaName, validateTemplate,
  validateVariablePlan, type TemplateInput,
} from "@/lib/whatsapp/template-builder";
import { queueBroadcast } from "@/lib/whatsapp/broadcast-runner";
import { normalizePhone, phoneVariants } from "@/lib/whatsapp/phone";
import { parseMessagingLimit, parseQuality, remainingCapacity } from "@/lib/whatsapp/limits";
import { isRestricted } from "@/lib/whatsapp/enforcement";

const WA_API_URL = "https://graph.facebook.com/v25.0";

export type OpResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; code?: string; issues?: unknown };

const ok = <T>(data: T): OpResult<T> => ({ ok: true, data });
const fail = (status: number, error: string, code?: string, issues?: unknown): OpResult<never> => ({ ok: false, status, error, code, issues });

type Db = any;

async function planOf(db: Db, userId: string): Promise<string> {
  const { data } = await db.from("users").select("plan_type").eq("id", userId).maybeSingle();
  return String(data?.plan_type ?? "free").toUpperCase();
}
const isFree = (plan: string) => plan === "FREE" || plan === "EXPIRED";

// ── Connection ───────────────────────────────────────────────────────────────

/**
 * Everything a business needs to send safely: connection, Meta's quality rating, the
 * messaging limit and how much of it is used in the last 24 hours, and any restriction.
 */
export async function getAccountHealth(db: Db, userId: string) {
  const { data: c } = await db.from("wa_connections")
    .select("status, phone_number, display_name, quality_rating, messaging_limit_tier, quality_paused_at, token_expires_at, last_error, restriction_summary, restriction_blocks, restricted_until")
    .eq("user_id", userId).maybeSingle();
  const plan = (await planOf(db, userId)).toLowerCase();
  if (!c) return { connected: false, plan } as const;

  const { data: used } = await db.rpc("unique_template_recipients_24h", { p_user: userId });
  const limit = parseMessagingLimit(c.messaging_limit_tier);
  const usedLast24h: number = used ?? 0;
  const remaining = remainingCapacity({ limit, usedLast24h });
  const quality = parseQuality(c.quality_rating);
  const restricted = isRestricted(c);

  return {
    connected: c.status === "active",
    status: c.status as string,
    phone_number: c.phone_number as string,
    business_name: c.display_name as string | null,
    plan,
    quality: { level: quality.level, label: quality.label, rating: c.quality_rating as string | null, promotions_paused: !!c.quality_paused_at },
    messaging_limit: {
      per_24_hours: limit.limit, label: limit.label, assumed: limit.assumed,
      used_last_24h: usedLast24h, remaining: Number.isFinite(remaining) ? remaining : null,
    },
    restriction: restricted ? { summary: c.restriction_summary as string, until: c.restricted_until as string | null } : null,
    token_expires_at: c.token_expires_at as string | null,
    last_error: c.last_error as string | null,
  };
}

export async function getStatus(db: Db, userId: string) {
  return ok(await getAccountHealth(db, userId));
}

// ── Contacts ─────────────────────────────────────────────────────────────────

export async function listContacts(db: Db, userId: string, opts: { search?: string; label?: string; limit?: number } = {}) {
  let q = db.from("wa_contacts")
    .select("id, phone_number, display_name, labels, is_opted_in, consent_purposes, last_message_at, message_count")
    .eq("user_id", userId).order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(Math.min(Math.max(opts.limit ?? 50, 1), 200));
  if (opts.label) q = q.contains("labels", [opts.label]);
  if (opts.search) {
    const s = opts.search.replace(/[%,()]/g, " ").trim();
    if (s) q = q.or(`phone_number.ilike.%${s}%,display_name.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error) return fail(500, error.message);
  return ok(data ?? []);
}

export interface AddContactInput {
  phone_number: string;
  display_name?: string | null;
  labels?: string[];
  /** The business must confirm the person agreed to be messaged (DPDP Act). */
  consent_confirmed: boolean;
  consent_purposes?: ConsentPurpose[];
  consent_source?: "dashboard" | "import" | "api";
}

export async function addContact(db: Db, userId: string, input: AddContactInput) {
  const phone = normalizePhone(input.phone_number);
  if (!phone) return fail(400, "phone_number must include the country code, for example +919876543210.");
  if (input.consent_confirmed !== true) {
    return fail(400, "Confirm that this person agreed to receive WhatsApp messages (consent_confirmed: true).", "CONSENT_REQUIRED");
  }

  const plan = await planOf(db, userId);
  const key = (plan in PRICING_PLANS ? plan : "FREE") as keyof typeof PRICING_PLANS;
  const limit = PRICING_PLANS[key]?.limits?.contacts ?? PRICING_PLANS.FREE.limits.contacts;
  const { data: existing } = await db.from("wa_contacts").select("id").eq("user_id", userId).in("phone_number", phoneVariants(phone)).limit(1).maybeSingle();
  if (!existing) {
    const { count } = await db.from("wa_contacts").select("id", { count: "exact", head: true }).eq("user_id", userId);
    if ((count ?? 0) >= limit) return fail(403, `Contact limit reached (${limit} on your plan). Upgrade to add more.`, "LIMIT_REACHED");
  }

  const purposes: ConsentPurpose[] = (input.consent_purposes ?? []).filter((p): p is ConsentPurpose => p === "service_messages" || p === "marketing_messages");
  try {
    await recordConsent(db, {
      userId, phoneNumber: phone, action: "granted",
      source: input.consent_source === "import" ? "import" : input.consent_source === "api" ? "api" : "dashboard",
      purposes: purposes.length ? purposes : ["service_messages"],
      evidence: { confirmed_by_business: true },
    });
    const { data, error } = await db.from("wa_contacts")
      .update({ display_name: input.display_name || null, labels: input.labels ?? [] })
      .eq("user_id", userId).eq("phone_number", phone).select().single();
    if (error) throw error;
    return ok(data);
  } catch (e: any) {
    return fail(500, e.message);
  }
}

export async function setContactConsent(db: Db, userId: string, phone: string, optedIn: boolean, purposes?: ConsentPurpose[]) {
  const p = normalizePhone(phone);
  if (!p) return fail(400, "phone_number must include the country code.");
  const { data: contact } = await db.from("wa_contacts").select("id").eq("user_id", userId).in("phone_number", phoneVariants(p)).limit(1).maybeSingle();
  if (!contact) return fail(404, "No contact with that phone number.");
  try {
    await recordConsent(db, {
      userId, phoneNumber: p, action: optedIn ? "granted" : "withdrawn", source: "api",
      purposes: optedIn ? (purposes?.length ? purposes : ["service_messages"]) : undefined,
      evidence: { changed_by: "api" },
    });
    return ok({ phone_number: p, is_opted_in: optedIn });
  } catch (e: any) {
    return fail(500, e.message);
  }
}

// ── Templates ────────────────────────────────────────────────────────────────

export async function listTemplates(db: Db, userId: string) {
  const { data, error } = await db.from("wa_templates")
    .select("id, name, category, language, status, body_text, header_text, footer_text, buttons, rejection_reason, created_at")
    .eq("user_id", userId).order("created_at", { ascending: false });
  if (error) return fail(500, error.message);
  return ok(data ?? []);
}

export async function createTemplate(db: Db, userId: string, body: Record<string, any>) {
  const { name, category, language, body_text, header_text, footer_text, buttons, examples, template_type, expiry_minutes } = body;
  const isOtp = template_type === "otp" || category === "AUTHENTICATION";
  const input: TemplateInput = {
    name: String(name ?? ""),
    category: isOtp ? "AUTHENTICATION" : (["MARKETING", "UTILITY"].includes(category) ? category : "UTILITY"),
    language: language || "en_US",
    header_text: header_text || undefined,
    body_text: String(body_text ?? ""),
    footer_text: footer_text || undefined,
    buttons: Array.isArray(buttons) ? buttons : [],
    examples: Array.isArray(examples) ? examples.map(String) : defaultExamples(String(body_text ?? "")),
  };

  const problems = validateTemplate(input).filter((i) => i.level === "error");
  if (problems.length) return fail(400, problems[0].message, "INVALID_TEMPLATE", problems);

  if (isFree(await planOf(db, userId))) {
    return fail(403, "Message templates need a paid plan. Upgrade to Growth or Pro.", "PLAN_REQUIRED");
  }

  const metaName = toMetaName(input.name);
  const { data, error } = await db.from("wa_templates").upsert({
    user_id: userId, name: metaName, category: input.category, language: input.language,
    template_type: isOtp ? "otp" : "standard",
    body_text: isOtp ? null : input.body_text,
    header_text: input.header_text ?? null, footer_text: input.footer_text ?? null,
    buttons: input.buttons?.length ? input.buttons : null, examples: input.examples ?? null,
    rejection_reason: null, status: "pending",
  }, { onConflict: "user_id,name" }).select().single();
  if (error) return fail(500, error.message);

  const { data: conn } = await db.from("wa_connections").select("waba_id, access_token").eq("user_id", userId).maybeSingle();
  let metaError: string | null = null;
  if (conn?.waba_id && conn?.access_token) {
    try {
      const res = await fetch(`${WA_API_URL}/${conn.waba_id}/message_templates`, {
        method: "POST",
        headers: { Authorization: `Bearer ${conn.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: metaName, category: input.category, language: input.language,
          components: isOtp ? buildAuthComponents({ expiry_minutes: Number(expiry_minutes) || 10 }) : buildMetaComponents(input),
        }),
      });
      const meta = await res.json();
      if (meta.id) {
        await db.from("wa_templates").update({ meta_template_id: meta.id, status: "pending" }).eq("id", data.id);
        data.meta_template_id = meta.id;
      } else {
        metaError = meta.error?.error_user_msg || meta.error?.message || "Meta rejected the template";
      }
    } catch (e: any) {
      metaError = e.message;
    }
  } else {
    metaError = "WhatsApp is not connected, so the template was saved but not submitted to Meta.";
  }
  return ok({ template: data, meta_error: metaError });
}

// ── Automations ──────────────────────────────────────────────────────────────

export async function listAutomations(db: Db, userId: string) {
  const { data, error } = await db.from("wa_automations")
    .select("id, name, trigger_type, trigger_keyword, message_type, reply_message, media_url, button_options, is_active, sent_count, last_fired_at, last_error")
    .eq("user_id", userId).order("created_at", { ascending: false });
  if (error) return fail(500, error.message);
  return ok(data ?? []);
}

export async function createAutomation(db: Db, userId: string, body: Record<string, any>) {
  const { name, trigger_keyword, trigger_type, reply_message, message_type, media_url, button_options } = body;
  if (!name) return fail(400, "Give the automation a name.");
  const type = trigger_type || "keyword";
  if (!["keyword", "any", "welcome"].includes(type)) return fail(400, "trigger_type must be keyword, any or welcome.");
  if (type === "keyword" && !String(trigger_keyword ?? "").trim()) return fail(400, "A keyword automation needs a trigger_keyword.");

  const msgType = message_type || "text";
  if (!["text", "image", "video", "document", "buttons", "list"].includes(msgType)) return fail(400, "Unsupported message_type.");
  if (msgType === "text" && !reply_message) return fail(400, "A text automation needs reply_message.");
  if (["image", "video", "document"].includes(msgType) && !media_url) return fail(400, "Media automations need a media_url (public https link).");
  if (media_url && !/^https:\/\//i.test(media_url)) return fail(400, "media_url must be a public https link.");
  if (msgType === "list") {
    const e = validateListOptions(button_options, reply_message);
    if (e) return fail(400, e);
  }
  if (msgType === "buttons") {
    if (!reply_message) return fail(400, "Button messages need body text in reply_message.");
    const btns = button_options?.buttons ?? [];
    if (!btns.length) return fail(400, "Add at least one button (maximum 3).");
    if (btns.length > 3) return fail(400, "WhatsApp allows at most 3 buttons.");
    if (btns.some((b: any) => !b?.title || String(b.title).length > 20)) return fail(400, "Each button needs a title of 20 characters or fewer.");
  }

  const plan = await planOf(db, userId);
  const key = (plan in PRICING_PLANS ? plan : "FREE") as keyof typeof PRICING_PLANS;
  const limit = PRICING_PLANS[key]?.limits?.automations ?? PRICING_PLANS.FREE.limits.automations;
  const { count } = await db.from("wa_automations").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if ((count ?? 0) >= limit) return fail(403, `Automation limit reached (${limit} on your plan). Upgrade to create more.`, "LIMIT_REACHED");

  const { data, error } = await db.from("wa_automations").insert({
    user_id: userId, name, trigger_keyword: trigger_keyword || null, trigger_type: type,
    reply_message: reply_message || null, message_type: msgType, media_url: media_url || null,
    button_options: button_options || null, is_active: true,
  }).select().single();
  if (error) return fail(500, error.message);
  return ok(data);
}

export async function updateAutomation(db: Db, userId: string, id: string, patch: { is_active?: boolean; name?: string; reply_message?: string }) {
  const updates: Record<string, any> = {};
  if (typeof patch.is_active === "boolean") updates.is_active = patch.is_active;
  if (typeof patch.name === "string" && patch.name.trim()) updates.name = patch.name.trim();
  if (typeof patch.reply_message === "string") updates.reply_message = patch.reply_message;
  if (!Object.keys(updates).length) return fail(400, "Nothing to update. Send is_active, name or reply_message.");
  const { data, error } = await db.from("wa_automations").update(updates).eq("id", id).eq("user_id", userId).select().maybeSingle();
  if (error) return fail(500, error.message);
  if (!data) return fail(404, "Automation not found.");
  return ok(data);
}

export async function deleteAutomation(db: Db, userId: string, id: string) {
  const { data, error } = await db.from("wa_automations").delete().eq("id", id).eq("user_id", userId).select("id").maybeSingle();
  if (error) return fail(500, error.message);
  if (!data) return fail(404, "Automation not found.");
  return ok({ deleted: true });
}

// ── Broadcasts ───────────────────────────────────────────────────────────────

export interface AudienceInput {
  contact_ids?: string[];
  phones?: string[];
  label?: string;
  /** Every contact in the account. Resolved inside the database, so any audience size is fine. */
  all_contacts?: boolean;
}

const CHUNK = 5000;

/** Contact ids named explicitly (ids and phone numbers). Label and "all" are resolved by SQL instead. */
async function explicitContactIds(db: Db, userId: string, a: AudienceInput): Promise<string[]> {
  const ids = new Set<string>(a.contact_ids ?? []);
  const phones = (a.phones ?? []).map(normalizePhone).filter((p): p is string => !!p).flatMap(phoneVariants);
  for (let i = 0; i < phones.length; i += 500) {
    const { data } = await db.from("wa_contacts").select("id").eq("user_id", userId).in("phone_number", phones.slice(i, i + 500));
    (data ?? []).forEach((c: any) => ids.add(c.id));
  }
  return [...ids];
}

const hasAudience = (a: AudienceInput) => !!(a.all_contacts || a.label || a.contact_ids?.length || a.phones?.length);

/** Who a broadcast would reach and who would be skipped, without creating anything. */
export async function previewBroadcast(db: Db, userId: string, input: { template_id?: string; template_name?: string } & AudienceInput) {
  const tpl = await findTemplate(db, userId, input);
  if (!tpl) return fail(404, "Template not found.");
  if (!hasAudience(input)) return fail(400, "Choose who to send to: all contacts, a label, or specific contacts.");

  const ids = await explicitContactIds(db, userId, input);
  let totals = { selected: 0, will_send: 0, opted_out: 0, no_marketing_consent: 0 };
  const marketing = tpl.category === "MARKETING";
  // Set-based sources (label / all) are counted once; explicit ids in chunks.
  const parts: Array<{ ids: string[] | null; label?: string; all?: boolean }> = [];
  if (input.all_contacts) parts.push({ ids: null, all: true });
  else {
    if (input.label) parts.push({ ids: null, label: input.label });
    for (let i = 0; i < ids.length; i += CHUNK) parts.push({ ids: ids.slice(i, i + CHUNK) });
  }
  for (const part of parts) {
    const { data, error } = await db.rpc("audience_preview", { p_user: userId, p_contact_ids: part.ids, p_label: part.label ?? null, p_all: !!part.all, p_marketing: marketing });
    if (error) return fail(500, error.message);
    totals = { selected: totals.selected + data.selected, will_send: totals.will_send + data.will_send, opted_out: totals.opted_out + data.opted_out, no_marketing_consent: totals.no_marketing_consent + data.no_marketing_consent };
  }
  if (totals.selected === 0) return fail(400, "No matching contacts. Check the label or phone numbers.");
  return ok({
    template: { id: tpl.id, name: tpl.name, category: tpl.category, status: tpl.status },
    selected: totals.selected, will_send: totals.will_send,
    skipped_opted_out: totals.opted_out, skipped_no_marketing_consent: totals.no_marketing_consent,
    template_approved: tpl.status === "approved",
    note: marketing ? "Marketing templates are billed by Meta at its marketing rate." : "Billed by Meta at its template rate.",
  });
}

async function findTemplate(db: Db, userId: string, input: { template_id?: string; template_name?: string }) {
  let q = db.from("wa_templates").select("id, name, body_text, category, status").eq("user_id", userId);
  if (input.template_id) q = q.eq("id", input.template_id);
  else if (input.template_name) q = q.eq("name", toMetaName(input.template_name));
  else return null;
  const { data } = await q.limit(1).maybeSingle();
  return data ?? null;
}

export async function createBroadcast(db: Db, userId: string, input: {
  name: string; template_id?: string; template_name?: string; scheduled_at?: string | null; variables?: unknown;
} & AudienceInput) {
  if (!input.name?.trim()) return fail(400, "Give the broadcast a name.");
  if (isFree(await planOf(db, userId))) return fail(403, "Broadcasts need a paid plan. Upgrade to Growth or Pro.", "PLAN_REQUIRED");

  const tpl = await findTemplate(db, userId, input);
  if (!tpl) return fail(404, "Template not found.");
  if (tpl.category === "AUTHENTICATION") return fail(400, "Verification-code templates are sent one at a time through the API, not as broadcasts.");

  const planError = validateVariablePlan(tpl.body_text ?? "", input.variables as any);
  if (planError) return fail(400, planError, "INVALID_VARIABLES");

  if (!hasAudience(input)) return fail(400, "Choose who to send to: all contacts, a label, or specific contacts.");
  const ids = await explicitContactIds(db, userId, input);

  const scheduled = input.scheduled_at && new Date(input.scheduled_at) > new Date();
  const { data: broadcast, error } = await db.from("wa_broadcasts").insert({
    user_id: userId, name: input.name.trim(), template_id: tpl.id,
    status: scheduled ? "scheduled" : "draft", scheduled_at: input.scheduled_at || null,
    variables: Array.isArray(input.variables) ? input.variables : null, total_recipients: 0,
  }).select().single();
  if (error) return fail(500, error.message);

  // Recipients are added by the database in a few statements, whatever the audience size.
  let total = 0;
  const add = async (p: { ids?: string[] | null; label?: string | null; all?: boolean }) => {
    const { data, error: e } = await db.rpc("add_broadcast_recipients", { p_broadcast: broadcast.id, p_user: userId, p_contact_ids: p.ids ?? null, p_label: p.label ?? null, p_all: !!p.all });
    if (e) throw new Error(e.message);
    total = data;
  };
  try {
    if (input.all_contacts) await add({ all: true });
    else {
      if (input.label) await add({ label: input.label });
      for (let i = 0; i < ids.length; i += CHUNK) await add({ ids: ids.slice(i, i + CHUNK) });
    }
  } catch (e: any) {
    await db.from("wa_broadcasts").delete().eq("id", broadcast.id);
    return fail(500, e.message);
  }
  if (total === 0) {
    await db.from("wa_broadcasts").delete().eq("id", broadcast.id);
    return fail(400, "No matching contacts. Check the label or phone numbers.");
  }
  broadcast.total_recipients = total;
  return ok({ broadcast, scheduled: !!scheduled });
}

/** Puts the broadcast in line; a background worker sends it. Returns at once, whatever the audience size. */
export async function sendBroadcastNow(db: Db, userId: string, id: string) {
  const r = await queueBroadcast(db, userId, id);
  if (!r.ok) return fail(r.status, r.error, (r as any).code);
  return ok({ queued: true, already_queued: r.already, message: r.already ? "Already queued or sending." : "Queued. Sending starts within seconds and continues in the background. Check list_broadcasts for progress." });
}

export async function listBroadcasts(db: Db, userId: string, limit = 20) {
  const { data, error } = await db.from("wa_broadcasts")
    .select("id, name, status, scheduled_at, total_recipients, sent_count, delivered_count, read_count, failed_count, created_at")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(Math.min(limit, 100));
  if (error) return fail(500, error.message);
  return ok(data ?? []);
}

// ── Messages ─────────────────────────────────────────────────────────────────

export async function listMessages(db: Db, userId: string, opts: { phone?: string; limit?: number } = {}) {
  let q = db.from("wa_messages")
    .select("direction, from_phone, to_phone, message_type, content, status, created_at")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(Math.min(Math.max(opts.limit ?? 30, 1), 100));
  if (opts.phone) {
    const p = normalizePhone(opts.phone);
    if (p) q = q.or(`from_phone.eq.${p},to_phone.eq.${p}`);
  }
  const { data, error } = await q;
  if (error) return fail(500, error.message);
  return ok(data ?? []);
}
