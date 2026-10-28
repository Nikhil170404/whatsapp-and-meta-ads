import { describe, it, expect } from "vitest";
import { buildStrictCsp, cspHeaderName, cspMode, needsStrictCsp, newNonce } from "../lib/security/csp";

const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(name + " "))!;

describe("strict CSP", () => {
  const nonce = newNonce();
  const csp = buildStrictCsp(nonce);

  it("blocks inline scripts and eval, allows only the nonce and what it loads", () => {
    const script = directive(csp, "script-src");
    expect(script).toContain(`'nonce-${nonce}'`);
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
  });
  it("closes the usual escape hatches", () => {
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'self'");
  });
  it("keeps what the app needs: Supabase, Razorpay, Meta, analytics", () => {
    expect(directive(csp, "connect-src")).toMatch(/supabase\.co.*razorpay.*graph\.facebook\.com/);
    expect(directive(csp, "frame-src")).toContain("https://checkout.razorpay.com");
    expect(directive(csp, "script-src")).toContain("https://checkout.razorpay.com");
  });
  it("uses a different nonce every request", () => {
    expect(new Set(Array.from({ length: 50 }, newNonce)).size).toBe(50);
    expect(newNonce()).toMatch(/^[A-Za-z0-9+/=]{20,}$/);
  });
});

describe("where it applies", () => {
  it("covers the signed-in app, not the marketing pages", () => {
    for (const p of ["/wa", "/wa/automations", "/signin", "/admin/login"]) expect(needsStrictCsp(p)).toBe(true);
    for (const p of ["/", "/privacy", "/terms", "/data-request", "/waitlist", "/wallet"]) expect(needsStrictCsp(p)).toBe(false);
  });
});

describe("mode switch", () => {
  it("defaults to enforce and offers report-only and off", () => {
    expect(cspMode(undefined)).toBe("enforce");
    expect(cspMode("nonsense")).toBe("enforce");
    expect(cspMode("report-only")).toBe("report-only");
    expect(cspMode("off")).toBe("off");
    expect(cspHeaderName("report-only")).toBe("Content-Security-Policy-Report-Only");
    expect(cspHeaderName("enforce")).toBe("Content-Security-Policy");
  });
});
