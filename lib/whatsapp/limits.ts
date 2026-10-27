/**
 * Messaging limits and number quality, as Meta defines them.
 *
 * Messaging limit (Meta docs): the number of distinct WhatsApp users a business
 * portfolio can message outside customer service windows in a rolling 24 hours.
 * Tiers are 250, 2,000, 10,000, 100,000 and unlimited. New portfolios start at
 * 250. The limit belongs to the whole portfolio, so every number shares it.
 *
 * The API reports tiers as strings (TIER_250, TIER_2K, TIER_10K, TIER_100K,
 * TIER_UNLIMITED; older accounts also show TIER_50, TIER_1K or TIER_1..TIER_4)
 * and quality as GREEN, YELLOW or RED (NA when not yet rated).
 */

export interface MessagingLimit {
  /** Distinct customers per rolling 24 hours, or null when unlimited. */
  limit: number | null;
  label: string;
  /** True when we could not recognise the value and fell back to the safest limit. */
  assumed: boolean;
}

/** The safest assumption: where Meta starts every new portfolio. */
const FALLBACK_LIMIT = 250;

const LEGACY_TIERS: Record<string, number | null> = { "1": 1_000, "2": 10_000, "3": 100_000, "4": null };

export function parseMessagingLimit(raw: unknown): MessagingLimit {
  const value = String(raw ?? "").trim().toUpperCase();
  if (value === "TIER_UNLIMITED" || value === "UNLIMITED") return { limit: null, label: "Unlimited", assumed: false };
  if (value === "TIER_NOT_SET" || value === "") return { limit: FALLBACK_LIMIT, label: "250", assumed: true };

  const m = /^TIER_(\d+)(K?)$/.exec(value);
  if (m) {
    const n = Number(m[1]);
    let limit: number | null;
    if (m[2] === "K") limit = n * 1000;
    else if (m[1] in LEGACY_TIERS && n <= 4) limit = LEGACY_TIERS[m[1]]; // legacy TIER_1..TIER_4
    else limit = n;
    return { limit, label: limit === null ? "Unlimited" : limit.toLocaleString("en-US"), assumed: false };
  }
  return { limit: FALLBACK_LIMIT, label: "250", assumed: true };
}

export type QualityLevel = "good" | "medium" | "poor" | "unknown";

/** Accepts Meta's GREEN/YELLOW/RED and the older HIGH/MEDIUM/LOW. */
export function parseQuality(raw: unknown): { level: QualityLevel; label: string } {
  switch (String(raw ?? "").trim().toUpperCase()) {
    case "GREEN": case "HIGH": return { level: "good", label: "Good" };
    case "YELLOW": case "MEDIUM": return { level: "medium", label: "Medium" };
    case "RED": case "LOW": return { level: "poor", label: "Poor" };
    default: return { level: "unknown", label: "Not rated yet" };
  }
}

export interface CapacityInput {
  limit: MessagingLimit;
  /** Distinct customers messaged with templates in the last 24 hours. */
  usedLast24h: number;
}

/** How many more people can be messaged now. Infinity when unlimited. */
export function remainingCapacity({ limit, usedLast24h }: CapacityInput): number {
  if (limit.limit === null) return Infinity;
  return Math.max(0, limit.limit - Math.max(0, usedLast24h));
}
