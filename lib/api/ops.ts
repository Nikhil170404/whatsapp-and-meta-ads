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
import { runBroadcast } from "@/lib/whatsapp/broadcast-runner";
import { normalizePhone, phoneVariants } from "@/lib/whatsapp/phone";

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

export async function getStatus(db: Db, userId: string) {
  const { data: c } = await db.from("wa_connections")
    .select("status, phone_number, display_name, quality_rating, messaging_tier, quality_paused_at, token_expires_at, last_error")
    .eq("user_id", userId).maybeSingle();
  const plan = (await planOf(db, userId)).toLowerCase();
  if (!c) return ok({ connected: false, plan });
  const tierLimits: Record<number, string> = { 1: "1,000", 2: "10,000", 3: "100,000", 4: "unlimited" };
  return ok({
    connected: c.status === "active",
    status: c.status,
    phone_number: c.phone_number,
    business_name: c.display_name,
    quality_rating: c.quality_rating,
    daily_unique_customer_limit: tierLimits[c.messaging_tier ?? 1] ?? "1,000",
    marketing_paused_for_quality: !!c.quality_paused_at,
    token_expires_at: c.token_expires_at,
    last_error: c.last_error,
    plan,
  });
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
}

async function resolveAudience(db: Db, userId: string, a: AudienceInput): Promise<string[]> {
  const ids = new Set<string>(a.contact_ids ?? []);
  if (a.phones?.length) {
    const phones = a.phones.map(normalizePhone).filter((p): p is string => !!p).flatMap(phoneVariants);
    const { data } = await db.from("wa_contacts").select("id").eq("user_id", userId).in("phone_number", phones);
    (data ?? []).forEach((c: any) => ids.add(c.id));
  }
  if (a.label) {
    const { data } = await db.from("wa_contacts").select("id").eq("user_id", userId).contains("labels", [a.label]);
    (data ?? []).forEach((c: any) => ids.add(c.id));
  }
  return [...ids];
}

/** Who a broadcast would reach and who would be skipped, without creating anything. */
export async function previewBroadcast(db: Db, userId: string, input: { template_id?: string; template_name?: string } & AudienceInput) {
  const tpl = await findTemplate(db, userId, input);
  if (!tpl) return fail(404, "Template not found.");
  const ids = await resolveAudience(db, userId, input);
  if (!ids.length) return fail(400, "No matching contacts. Add contacts first, or check the phones/label.");
  const { data: contacts } = await db.from("wa_contacts").select("id, is_opted_in, consent_purposes").eq("user_id", userId).in("id", ids);
  let eligible = 0, optedOut = 0, noMarketing = 0;
  for (const c of contacts ?? []) {
    if (c.is_opted_in === false) optedOut++;
    else if (tpl.category === "MARKETING" && !hasMarketingConsent(c)) noMarketing++;
    else eligible++;
  }
  return ok({
    template: { id: tpl.id, name: tpl.name, category: tpl.category, status: tpl.status },
    selected: ids.length, will_send: eligible,
    skipped_opted_out: optedOut, skipped_no_marketing_consent: noMarketing,
    template_approved: tpl.status === "approved",
    note: tpl.category === "MARKETING" ? "Marketing templates are billed by Meta at its marketing rate." : "Billed by Meta at its template rate.",
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

  const ids = await resolveAudience(db, userId, input);
  if (!ids.length) return fail(400, "Choose at least one contact.");
  const { data: owned } = await db.from("wa_contacts").select("id").eq("user_id", userId).in("id", ids);
  if ((owned ?? []).length !== ids.length) return fail(400, "One or more contacts are invalid.");

  const scheduled = input.scheduled_at && new Date(input.scheduled_at) > new Date();
  const { data: broadcast, error } = await db.from("wa_broadcasts").insert({
    user_id: userId, name: input.name.trim(), template_id: tpl.id,
    status: scheduled ? "scheduled" : "draft", scheduled_at: input.scheduled_at || null,
    variables: Array.isArray(input.variables) ? input.variables : null, total_recipients: ids.length,
  }).select().single();
  if (error) return fail(500, error.message);

  const { error: rErr } = await db.from("wa_broadcast_recipients").insert(ids.map((cid) => ({ broadcast_id: broadcast.id, contact_id: cid, status: "pending" })));
  if (rErr) return fail(500, rErr.message);
  return ok({ broadcast, scheduled: !!scheduled });
}

export async function sendBroadcastNow(db: Db, userId: string, id: string) {
  const r = await runBroadcast(db, userId, id);
  if (r.status >= 400) return fail(r.status, String((r.body as any).error ?? "Could not send the broadcast."), (r.body as any).code);
  return ok(r.body);
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
