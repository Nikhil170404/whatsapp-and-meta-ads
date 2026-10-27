/**
 * DPDP Act 2023 consent helpers.
 *
 * Every change to a contact's consent state writes an append-only row to
 * wa_consent_logs so the business can prove when, how and for what purpose a
 * data principal agreed (or withdrew).
 */

import { contactKey } from "@/lib/whatsapp/phone";

export const CONSENT_NOTICE_VERSION = "2026-10";

export const CONSENT_PURPOSES = {
  service_messages: "Replies and updates about your enquiry or order",
  marketing_messages: "Offers, promotions and product announcements",
} as const;

export type ConsentPurpose = keyof typeof CONSENT_PURPOSES;

export type ConsentSource =
  | "whatsapp_keyword"
  | "whatsapp_first_contact"
  | "dashboard"
  | "import"
  | "api"
  | "ctwa_ad"
  | "web_form"
  | "whatsapp_preferences";

interface RecordConsentInput {
  userId: string;
  phoneNumber: string;
  action: "granted" | "withdrawn";
  source: ConsentSource;
  purposes?: ConsentPurpose[];
  evidence?: Record<string, unknown>;
}

/**
 * Updates the contact row and appends a consent log entry.
 * Withdrawal always applies to every purpose; grant applies to the purposes given.
 */
export async function recordConsent(supabase: any, rawInput: RecordConsentInput) {
  const input = { ...rawInput, phoneNumber: contactKey(rawInput.phoneNumber) };
  const now = new Date().toISOString();
  const purposes = input.action === "withdrawn" ? [] : input.purposes ?? ["service_messages"];

  const contactUpdate =
    input.action === "granted"
      ? {
          is_opted_in: true,
          opted_in_at: now,
          opted_out_at: null,
          consent_source: input.source,
          consent_purposes: purposes,
          consent_notice_version: CONSENT_NOTICE_VERSION,
        }
      : {
          is_opted_in: false,
          opted_out_at: now,
          consent_purposes: [],
        };

  const { data: contact, error } = await supabase
    .from("wa_contacts")
    .upsert(
      { user_id: input.userId, phone_number: input.phoneNumber, ...contactUpdate },
      { onConflict: "user_id,phone_number" }
    )
    .select("id")
    .single();
  if (error) throw error;

  const { error: logError } = await supabase.from("wa_consent_logs").insert({
    user_id: input.userId,
    contact_id: contact?.id ?? null,
    phone_number: input.phoneNumber,
    action: input.action,
    purposes,
    source: input.source,
    notice_version: CONSENT_NOTICE_VERSION,
    evidence: input.evidence ?? {},
  });
  if (logError) throw logError;

  return contact?.id as string | undefined;
}

/** A contact may receive template marketing only with explicit marketing consent. */
export function hasMarketingConsent(contact: {
  is_opted_in?: boolean | null;
  consent_purposes?: string[] | null;
}): boolean {
  if (contact.is_opted_in === false) return false;
  // Rows created before purposes were tracked have no purposes recorded.
  if (!contact.consent_purposes || contact.consent_purposes.length === 0) return true;
  return contact.consent_purposes.includes("marketing_messages");
}

/**
 * A customer stopped or resumed marketing messages from WhatsApp's own settings
 * (Meta's user_preferences webhook). Only marketing consent changes; they can
 * still receive service replies.
 */
export async function recordMarketingPreference(
  supabase: any,
  rawInput: { userId: string; phoneNumber: string; value: "stop" | "resume"; evidence?: Record<string, unknown> }
) {
  const input = { ...rawInput, phoneNumber: contactKey(rawInput.phoneNumber) };
  const { data: existing } = await supabase
    .from("wa_contacts")
    .select("consent_purposes")
    .eq("user_id", input.userId)
    .eq("phone_number", input.phoneNumber)
    .maybeSingle();

  const current: string[] = existing?.consent_purposes?.length ? existing.consent_purposes : ["service_messages"];
  const withoutMarketing = current.filter((p) => p !== "marketing_messages");
  const purposes = input.value === "resume" ? [...new Set([...withoutMarketing, "service_messages", "marketing_messages"])] : withoutMarketing.length ? withoutMarketing : ["service_messages"];

  const { data: contact, error } = await supabase
    .from("wa_contacts")
    .upsert(
      { user_id: input.userId, phone_number: input.phoneNumber, consent_purposes: purposes, consent_notice_version: CONSENT_NOTICE_VERSION },
      { onConflict: "user_id,phone_number" }
    )
    .select("id")
    .single();
  if (error) throw error;

  await supabase.from("wa_consent_logs").insert({
    user_id: input.userId,
    contact_id: contact?.id ?? null,
    phone_number: input.phoneNumber,
    action: input.value === "stop" ? "withdrawn" : "granted",
    purposes,
    source: "whatsapp_preferences",
    notice_version: CONSENT_NOTICE_VERSION,
    evidence: input.evidence ?? {},
  });
}
