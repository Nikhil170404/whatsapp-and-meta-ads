import { describe, it, expect } from "vitest";
import { describeTimeLeft, windowState } from "../lib/whatsapp/window";

const now = new Date("2026-10-28T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();

describe("windowState", () => {
  it("is open for 24 hours after the customer's last message", () => {
    const w = windowState(hoursAgo(2), now);
    expect(w.open).toBe(true);
    expect(Math.round(w.msLeft / 3600_000)).toBe(22);
  });
  it("closes after 24 hours", () => {
    expect(windowState(hoursAgo(25), now).open).toBe(false);
    expect(windowState(hoursAgo(24), now).open).toBe(false);
  });
  it("is closed when the customer never wrote", () => {
    expect(windowState(null, now)).toEqual({ open: false, closesAt: null, msLeft: 0 });
  });
  it("stays open longer for an ad conversation", () => {
    const adEnds = new Date(now.getTime() + 40 * 3600_000).toISOString();
    expect(windowState(hoursAgo(30), now, adEnds).open).toBe(true);
    expect(windowState(hoursAgo(30), now, new Date(now.getTime() - 1000).toISOString()).open).toBe(false);
  });
});

describe("describeTimeLeft", () => {
  it("reads naturally", () => {
    expect(describeTimeLeft(5 * 3600_000)).toBe("5 hours left");
    expect(describeTimeLeft(90 * 60_000)).toBe("about 1 hour left");
    expect(describeTimeLeft(40 * 60_000)).toBe("40 minutes left");
    expect(describeTimeLeft(10_000)).toBe("1 minute left");
  });
});
