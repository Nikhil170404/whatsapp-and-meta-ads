import { describe, it, expect } from "vitest";
import { parseMessagingLimit, parseQuality, remainingCapacity } from "../lib/whatsapp/limits";
import { classifyMetaError } from "../lib/whatsapp/errors";
import { isRestricted, parseAccountUpdate } from "../lib/whatsapp/enforcement";

describe("messaging limit tiers (Meta: 250, 2,000, 10,000, 100,000, unlimited)", () => {
  it("reads every documented tier value", () => {
    expect(parseMessagingLimit("TIER_50").limit).toBe(50);
    expect(parseMessagingLimit("TIER_250").limit).toBe(250);
    expect(parseMessagingLimit("TIER_2K").limit).toBe(2000);
    expect(parseMessagingLimit("TIER_10K").limit).toBe(10000);
    expect(parseMessagingLimit("TIER_100K").limit).toBe(100000);
    expect(parseMessagingLimit("TIER_UNLIMITED").limit).toBeNull();
  });
  it("reads older tier names", () => {
    expect(parseMessagingLimit("TIER_1K").limit).toBe(1000);
    expect(parseMessagingLimit("TIER_1").limit).toBe(1000);
    expect(parseMessagingLimit("TIER_2").limit).toBe(10000);
    expect(parseMessagingLimit("TIER_3").limit).toBe(100000);
    expect(parseMessagingLimit("TIER_4").limit).toBeNull();
  });
  it("falls back to 250, where new portfolios start, never higher", () => {
    for (const v of [undefined, null, "", "TIER_NOT_SET", "WEIRD", "TIER_"]) {
      const r = parseMessagingLimit(v);
      expect(r.limit).toBe(250);
      expect(r.assumed).toBe(true);
    }
  });
  it("computes remaining capacity", () => {
    expect(remainingCapacity({ limit: parseMessagingLimit("TIER_250"), usedLast24h: 100 })).toBe(150);
    expect(remainingCapacity({ limit: parseMessagingLimit("TIER_250"), usedLast24h: 900 })).toBe(0);
    expect(remainingCapacity({ limit: parseMessagingLimit("TIER_UNLIMITED"), usedLast24h: 5_000_000 })).toBe(Infinity);
  });
});

describe("quality rating", () => {
  it("understands Meta's GREEN / YELLOW / RED and the older HIGH / MEDIUM / LOW", () => {
    expect(parseQuality("GREEN").level).toBe("good");
    expect(parseQuality("YELLOW").level).toBe("medium");
    expect(parseQuality("RED").level).toBe("poor");
    expect(parseQuality("LOW").level).toBe("poor");
    expect(parseQuality("NA").level).toBe("unknown");
    expect(parseQuality(undefined).level).toBe("unknown");
  });
});

describe("Meta error handling", () => {
  it("stops the whole broadcast for problems that would repeat for everyone", () => {
    for (const code of [190, 131042, 131031, 368, 131048, 132015, 132016, 132001, 132000, 132012, 132007]) {
      expect(classifyMetaError(code).action).toBe("abort");
    }
    expect(classifyMetaError(190)).toMatchObject({ tokenExpired: true });
    expect(classifyMetaError(132015)).toMatchObject({ templateProblem: true });
  });
  it("slows down on rate limits and maintenance", () => {
    for (const code of [130429, 80007, 131057]) expect(classifyMetaError(code).action).toBe("throttle");
  });
  it("skips just the person for per-recipient problems", () => {
    for (const code of [131049, 131050, 131056, 131026, 131047]) expect(classifyMetaError(code).action).toBe("skip");
    expect(classifyMetaError(131050)).toMatchObject({ marketingOptOut: true });
  });
  it("does not confuse the pair rate limit with an opt-out", () => {
    expect(classifyMetaError(131056)).toMatchObject({ action: "skip" });
    expect((classifyMetaError(131056) as any).marketingOptOut).toBeUndefined();
  });
  it("records anything unknown as a failure with Meta's message", () => {
    expect(classifyMetaError(999999, "Something odd")).toEqual({ action: "fail", reason: "Something odd" });
  });
});

describe("account_update enforcement", () => {
  it("blocks business-started messages during a restriction, until it expires", () => {
    const future = Math.floor(Date.now() / 1000) + 5 * 86400;
    const s = parseAccountUpdate({ event: "ACCOUNT_RESTRICTION", restriction_info: [{ restriction_type: "RESTRICTED_BIZ_INITIATED_MESSAGING", expiration: future }] })!;
    expect(s.blocksBusinessInitiated).toBe(true);
    expect(s.until!.getTime()).toBe(future * 1000);
    expect(s.summary).toMatch(/restricted/);
    expect(isRestricted({ restricted_until: s.until!.toISOString(), restriction_blocks: true })).toBe(true);
    expect(isRestricted({ restricted_until: new Date(Date.now() - 1000).toISOString(), restriction_blocks: true })).toBe(false);
    expect(isRestricted({ restricted_until: null, restriction_blocks: false })).toBe(false);
  });
  it("treats a utility-template restriction as narrower", () => {
    const s = parseAccountUpdate({ event: "ACCOUNT_RESTRICTION", restriction_info: [{ restriction_type: "RESTRICTED_UTILITY_TEMPLATES", expiration: 4102444800 }] })!;
    expect(s.blocksBusinessInitiated).toBe(false);
    expect(s.blocksUtilityTemplates).toBe(true);
  });
  it("handles violations, bans, reinstatement and unknown events", () => {
    expect(parseAccountUpdate({ event: "ACCOUNT_VIOLATION", violation_info: { violation_type: "ADULT" } })!.summary).toMatch(/adult/);
    expect(parseAccountUpdate({ event: "DISABLED_UPDATE", ban_info: { waba_ban_state: "DISABLE", waba_ban_date: "April 17, 2025" } })).toMatchObject({ banned: true, blocksBusinessInitiated: true });
    expect(parseAccountUpdate({ event: "DISABLED_UPDATE", ban_info: { waba_ban_state: "SCHEDULE_FOR_DISABLE" } })).toMatchObject({ banned: false, blocksBusinessInitiated: true });
    expect(parseAccountUpdate({ event: "DISABLED_UPDATE", ban_info: { waba_ban_state: "REINSTATE" } })).toMatchObject({ summary: "", blocksBusinessInitiated: false });
    expect(parseAccountUpdate({ event: "PARTNER_ADDED" })).toBeNull();
  });
});
