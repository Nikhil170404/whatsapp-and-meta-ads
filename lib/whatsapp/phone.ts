/**
 * One canonical phone format everywhere: digits only, country code first
 * (for example "919876543210"). This is how WhatsApp reports customers in
 * webhooks, so contacts, consent records and messages all line up. Storing
 * "+91…" in one place and "91…" in another splits one person into two
 * contacts and lets an opt-out miss the contact that broadcasts use.
 */
export function normalizePhone(input: unknown): string | null {
  if (typeof input !== "string" && typeof input !== "number") return null;
  let digits = String(input).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2); // 0091… international prefix
  return digits.length >= 7 && digits.length <= 15 ? digits : null;
}

/** Values a phone may have been stored as before normalisation was introduced. */
export const phoneVariants = (digits: string) => [digits, `+${digits}`];

/** "919876543210" → "+919876543210" for display. Leaves user ids and odd values alone. */
export const displayPhone = (stored: string) => (/^\d{7,15}$/.test(stored) ? `+${stored}` : stored);

/** Key a contact is stored under: a normalised phone, or a business-scoped user id left as is. */
export function contactKey(value: string): string {
  if (/^[A-Z]{2}\./.test(value)) return value; // BSUID, e.g. "IN.13491208655302741918"
  return normalizePhone(value) ?? value;
}
