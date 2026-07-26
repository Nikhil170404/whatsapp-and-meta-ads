/**
 * Meta messaging limits — how many DIFFERENT customers a number may start a
 * conversation with in a rolling 24 hours.
 *
 * Two things this limit does NOT count, which matters when showing it to users:
 *   - replies to customers who messaged first (service messages inside the
 *     24-hour window are unlimited), and
 *   - repeat messages to the same person — ten messages to one customer is one
 *     recipient.
 * So keyword auto-replies never consume the limit; only business-initiated
 * template sends (broadcasts, order notifications) do.
 *
 * Meta reports the tier as a string on the phone number node, and the values are
 * NOT sequential: TIER_250, TIER_1K, TIER_10K, TIER_100K, TIER_UNLIMITED.
 * Parsing them as integers is what produced the bugs this module replaces —
 * "TIER_10K" read as 10 and "TIER_UNLIMITED" read as NaN, both of which then fell
 * back to the 1,000/day cap and throttled customers who had earned more.
 */

/** Daily unique-recipient allowance per tier string Meta returns. */
export const TIER_DAILY_LIMITS: Record<string, number> = {
  TIER_50: 50,
  TIER_250: 250,
  TIER_1K: 1_000,
  TIER_10K: 10_000,
  TIER_100K: 100_000,
  TIER_UNLIMITED: Infinity,
};

/** Tier Meta assigns before the customer completes business verification. */
export const DEFAULT_TIER = "TIER_250";

export interface MessagingLimit {
  /** Raw value from Meta, e.g. "TIER_1K". */
  tier: string;
  /** Unique recipients per 24h. Infinity for TIER_UNLIMITED. */
  dailyLimit: number;
  /** Human label for the UI, e.g. "1,000 / day". */
  label: string;
}

/**
 * Normalises whatever Meta sent into a tier plus its numeric allowance.
 * Accepts the phone-number field (`messaging_limit_tier`) and the webhook field
 * (`current_limit`), which use the same vocabulary.
 */
export function parseMessagingTier(raw: string | null | undefined): MessagingLimit {
  const tier = (raw ?? "").trim().toUpperCase();

  if (tier in TIER_DAILY_LIMITS) {
    return { tier, dailyLimit: TIER_DAILY_LIMITS[tier], label: formatLimit(TIER_DAILY_LIMITS[tier]) };
  }

  // Unrecognised or missing — assume the most restrictive real tier rather than a
  // generous one, so we never send past what Meta will actually accept.
  return {
    tier: DEFAULT_TIER,
    dailyLimit: TIER_DAILY_LIMITS[DEFAULT_TIER],
    label: formatLimit(TIER_DAILY_LIMITS[DEFAULT_TIER]),
  };
}

export function formatLimit(dailyLimit: number): string {
  if (!Number.isFinite(dailyLimit)) return "Unlimited";
  return `${dailyLimit.toLocaleString("en-IN")} / day`;
}

/**
 * Legacy ordinal for the integer `messaging_tier` column that older code reads.
 * Kept so both representations stay consistent while callers migrate.
 */
export function tierOrdinal(tier: string): number {
  const order = ["TIER_50", "TIER_250", "TIER_1K", "TIER_10K", "TIER_100K", "TIER_UNLIMITED"];
  const idx = order.indexOf(tier);
  // TIER_1K has historically been stored as 1, so anchor the scale there.
  return idx < 0 ? 1 : Math.max(1, idx - 1);
}

/** Quality ratings Meta reports, plus what they mean for tier movement. */
export function describeQuality(rating: string | null | undefined): {
  label: string;
  tone: "good" | "warn" | "bad" | "unknown";
  detail: string;
} {
  switch ((rating ?? "").toUpperCase()) {
    case "GREEN":
    case "HIGH":
      return { label: "High", tone: "good", detail: "Healthy — your tier can keep increasing." };
    case "YELLOW":
    case "MEDIUM":
      return { label: "Medium", tone: "warn", detail: "Meta has frozen tier increases until this recovers." };
    case "RED":
    case "LOW":
      return { label: "Low", tone: "bad", detail: "Too many blocks or reports. Meta may reduce your limit." };
    default:
      return { label: "Not rated yet", tone: "unknown", detail: "Meta rates quality once you have sent enough messages." };
  }
}
