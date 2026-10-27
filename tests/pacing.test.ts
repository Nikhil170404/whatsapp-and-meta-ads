import { describe, it, expect } from "vitest";
import { mapWithConcurrency, pacingDelayMs } from "../lib/whatsapp/pacing";

describe("mapWithConcurrency", () => {
  it("never runs more than the limit at once and keeps order", async () => {
    let inFlight = 0, peak = 0;
    const out = await mapWithConcurrency(Array.from({ length: 50 }, (_, i) => i), 8, async (n) => {
      inFlight++; peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 2));
      inFlight--;
      return n * 2;
    });
    expect(peak).toBeLessThanOrEqual(8);
    expect(out).toEqual(Array.from({ length: 50 }, (_, i) => i * 2));
  });
  it("handles an empty list and a limit larger than the list", async () => {
    expect(await mapWithConcurrency([], 5, async (x) => x)).toEqual([]);
    expect(await mapWithConcurrency([1, 2], 50, async (x) => x + 1)).toEqual([2, 3]);
  });
});

describe("pacingDelayMs", () => {
  it("waits out the rest of the time a batch should take", () => {
    expect(pacingDelayMs(200, 0, 40, 3000)).toBe(2000); // 200 at 40/s = 5s; took 3s
  });
  it("does not wait when the batch was already slow", () => {
    expect(pacingDelayMs(200, 0, 40, 9000)).toBe(0);
  });
  it("copes with a zero rate", () => {
    expect(pacingDelayMs(1, 0, 0, 0)).toBeGreaterThan(0);
  });
});
