/**
 * Resolves the name shown to a signed-in user.
 *
 * The Facebook account name is the wrong thing to display: on a Business
 * Portfolio it is often the *provider's* System User (e.g. "Replykaro System
 * User"), so every customer would see the platform's own name instead of their
 * business. The WhatsApp Business verified name is the customer's real business
 * name, so it wins whenever we have it.
 *
 * Precedence: WABA verified name → cleaned Facebook account name → email local
 * part → "there".
 */

const SYSTEM_SUFFIX_RE = /\s+(system\s+user|system|admin|user)$/i;

/** Placeholder values written when a real name was not available. */
const PLACEHOLDER_NAMES = new Set([
  "",
  "unknown",
  "whatsapp business",
  "whatsapp business account",
  "verified number",
]);

/** True when a stored name is one of the placeholders rather than a real value. */
export function isPlaceholderName(name: string | null | undefined): boolean {
  return PLACEHOLDER_NAMES.has((name ?? "").trim().toLowerCase());
}

const isPlaceholder = isPlaceholderName;

/** Strips trailing "System User" / "Admin" / "User" from a Facebook account name. */
export function cleanAccountName(name: string | null | undefined): string | null {
  if (!name) return null;
  return name.replace(SYSTEM_SUFFIX_RE, "").trim() || null;
}

/**
 * Picks the best available name. Pure so it can be unit-tested and reused by
 * client components that already hold the values.
 */
export function pickDisplayName(
  wabaVerifiedName: string | null | undefined,
  accountName: string | null | undefined,
  email: string | null | undefined,
  fallback = "there"
): string {
  const waba = (wabaVerifiedName ?? "").trim();
  if (waba && !isPlaceholder(waba)) return waba;

  const account = cleanAccountName(accountName);
  if (account && !isPlaceholder(account)) return account;

  const local = (email ?? "").split("@")[0]?.trim();
  if (local) return local;

  return fallback;
}

/**
 * Server-side resolver. One query pair, shared by the dashboard layout and the
 * overview page so they can never disagree about what to call the user.
 */
export async function resolveDisplayName(
  supabase: any,
  session: { id: string; display_name?: string | null; email?: string | null },
  fallback = "there"
): Promise<string> {
  const [{ data: userRow }, { data: waConn }] = await Promise.all([
    supabase.from("users").select("display_name, email").eq("id", session.id).maybeSingle(),
    supabase.from("wa_connections").select("display_name").eq("user_id", session.id).maybeSingle(),
  ]);

  return pickDisplayName(
    waConn?.display_name,
    userRow?.display_name ?? session.display_name,
    userRow?.email ?? session.email,
    fallback
  );
}
