import { describe, it, expect } from "vitest";
import { DEFAULT_WEEK, isOpenNow, shouldSendAway, validateHours, DEFAULT_AWAY_MESSAGE } from "../lib/whatsapp/hours";

// Mon–Sat 10:00–19:00, Sunday closed (Asia/Kolkata = UTC+5:30)
const at = (iso: string) => new Date(iso);

describe("isOpenNow", () => {
  it("is open during hours in the business's time zone", () => {
    expect(isOpenNow(DEFAULT_WEEK, "Asia/Kolkata", at("2026-10-28T06:00:00Z"))).toBe(true); // Wed 11:30 IST
  });
  it("is closed before opening and from closing time on", () => {
    expect(isOpenNow(DEFAULT_WEEK, "Asia/Kolkata", at("2026-10-28T04:00:00Z"))).toBe(false); // 09:30 IST
    expect(isOpenNow(DEFAULT_WEEK, "Asia/Kolkata", at("2026-10-28T13:30:00Z"))).toBe(false); // 19:00 IST exactly
    expect(isOpenNow(DEFAULT_WEEK, "Asia/Kolkata", at("2026-10-28T13:29:00Z"))).toBe(true);  // 18:59 IST
  });
  it("is closed on a closed day", () => {
    expect(isOpenNow(DEFAULT_WEEK, "Asia/Kolkata", at("2026-11-01T06:00:00Z"))).toBe(false); // Sunday
  });
  it("uses the business time zone, not UTC", () => {
    // 2026-10-28 22:00 UTC is already Thursday 03:30 IST (closed) but Wednesday 17:00 in New York time zone is open for the same week hours
    expect(isOpenNow(DEFAULT_WEEK, "Asia/Kolkata", at("2026-10-28T22:00:00Z"))).toBe(false);
    expect(isOpenNow(DEFAULT_WEEK, "America/New_York", at("2026-10-28T21:00:00Z"))).toBe(true); // Wed 17:00 EDT
  });
});

describe("shouldSendAway", () => {
  const base = { enabled: true, week: DEFAULT_WEEK, timeZone: "Asia/Kolkata" };
  const closed = at("2026-10-28T20:00:00Z"); // Thu 01:30 IST
  it("sends when closed and not sent recently", () => {
    expect(shouldSendAway({ ...base, lastAwayAt: null, now: closed })).toBe(true);
  });
  it("does not send while open, when disabled, or within the cool-down", () => {
    expect(shouldSendAway({ ...base, lastAwayAt: null, now: at("2026-10-28T06:00:00Z") })).toBe(false);
    expect(shouldSendAway({ ...base, enabled: false, lastAwayAt: null, now: closed })).toBe(false);
    expect(shouldSendAway({ ...base, lastAwayAt: new Date(closed.getTime() - 3600_000).toISOString(), now: closed })).toBe(false);
  });
  it("sends again after the cool-down", () => {
    expect(shouldSendAway({ ...base, lastAwayAt: new Date(closed.getTime() - 13 * 3600_000).toISOString(), now: closed })).toBe(true);
  });
});

describe("validateHours", () => {
  it("accepts the defaults", () => expect(validateHours(DEFAULT_WEEK, "Asia/Kolkata", DEFAULT_AWAY_MESSAGE)).toBeNull());
  it("rejects closing before opening", () => {
    const w = { ...DEFAULT_WEEK, mon: { open: true, from: "19:00", to: "10:00" } };
    expect(validateHours(w, "Asia/Kolkata", "x")).toMatch(/Monday.*after opening/);
  });
  it("rejects bad times, no open days, bad zone and empty message", () => {
    expect(validateHours({ ...DEFAULT_WEEK, tue: { open: true, from: "9am", to: "5pm" } }, "Asia/Kolkata", "x")).toMatch(/Tuesday/);
    const none = Object.fromEntries(Object.keys(DEFAULT_WEEK).map((k) => [k, { open: false, from: "10:00", to: "19:00" }]));
    expect(validateHours(none, "Asia/Kolkata", "x")).toMatch(/at least one day/);
    expect(validateHours(DEFAULT_WEEK, "Mars/Phobos", "x")).toMatch(/time zone/);
    expect(validateHours(DEFAULT_WEEK, "Asia/Kolkata", "  ")).toMatch(/away message/);
  });
});
