import { describe, it, expect, vi, afterEach } from "vitest";
import { FailureBackoff, isSchemaMissing } from "../worker/backoff";

afterEach(() => vi.restoreAllMocks());

describe("isSchemaMissing", () => {
  it("recognises a function or table the database does not have", () => {
    for (const code of ["PGRST202", "PGRST205", "42883", "42P01"]) expect(isSchemaMissing({ code })).toBe(true);
    expect(isSchemaMissing({ code: "23505" })).toBe(false);
    expect(isSchemaMissing(new Error("boom"))).toBe(false);
  });
});

describe("FailureBackoff", () => {
  it("waits longer after each failure, up to 30 seconds", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const b = new FailureBackoff();
    const waits = Array.from({ length: 10 }, () => b.fail("x", new Error("e")));
    expect(waits[0]).toBeLessThan(waits[3]);
    expect(Math.max(...waits)).toBe(30_000);
  });

  it("logs the first failure and then at most once a minute", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const b = new FailureBackoff();
    const t0 = 1_000_000;
    for (let i = 0; i < 50; i++) b.fail("x", new Error("e"), t0 + i * 500); // 25 seconds of failures
    expect(log).toHaveBeenCalledTimes(1);
    b.fail("x", new Error("e"), t0 + 61_000);
    expect(log).toHaveBeenCalledTimes(2);
  });

  it("tells you to run the schema when the database is out of date", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    new FailureBackoff().fail("webhook-consumer", { code: "PGRST202", message: "Could not find the function public.claim_webhook_events" });
    expect(String(log.mock.calls[0][0])).toMatch(/supabase\/schema\.sql/);
  });

  it("resets after a success", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    const b = new FailureBackoff();
    for (let i = 0; i < 5; i++) b.fail("x", new Error("e"));
    b.ok();
    expect(b.fail("x", new Error("e"))).toBe(1000);
  });
});
