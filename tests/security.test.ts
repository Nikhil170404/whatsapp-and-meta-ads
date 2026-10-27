// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import crypto from "node:crypto";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.restoreAllMocks(); });

const sign = (body: string, secret: string) => "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");

describe("webhook signature", () => {
  it("accepts a correct signature and rejects a wrong or missing one", async () => {
    vi.stubEnv("FACEBOOK_APP_SECRET", "app-secret"); vi.stubEnv("NODE_ENV", "production");
    const { verifyMetaSignature } = await import("../lib/meta-signature");
    const body = '{"object":"whatsapp_business_account"}';
    expect(verifyMetaSignature(body, sign(body, "app-secret"))).toBe(true);
    expect(verifyMetaSignature(body, sign(body, "other-secret"))).toBe(false);
    expect(verifyMetaSignature(body + " ", sign(body, "app-secret"))).toBe(false);
    expect(verifyMetaSignature(body, null)).toBe(false);
    expect(verifyMetaSignature(body, "sha256=zz")).toBe(false);
    expect(verifyMetaSignature(body, "nonsense")).toBe(false);
  });

  it("rejects everything in production when the app secret is missing (fail closed)", async () => {
    vi.stubEnv("FACEBOOK_APP_SECRET", ""); vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { verifyMetaSignature } = await import("../lib/meta-signature");
    expect(verifyMetaSignature("{}", sign("{}", "anything"))).toBe(false);
    expect(verifyMetaSignature("{}", null)).toBe(false);
  });

  it("allows unsigned webhooks only outside production, for local testing", async () => {
    vi.stubEnv("FACEBOOK_APP_SECRET", ""); vi.stubEnv("NODE_ENV", "development");
    const { verifyMetaSignature } = await import("../lib/meta-signature");
    expect(verifyMetaSignature("{}", null)).toBe(true);
  });
});

describe("session secret", () => {
  const user = { id: "u1", facebook_user_id: "1", display_name: "A", plan_type: "free", created_at: "x" };

  it("refuses to sign sessions in production without SESSION_SECRET (no hard-coded fallback)", async () => {
    vi.stubEnv("SESSION_SECRET", ""); vi.stubEnv("NODE_ENV", "production");
    const { createSession } = await import("../lib/auth/session");
    await expect(createSession(user)).rejects.toThrow(/SESSION_SECRET/);
  });

  it("refuses a too-short secret in production", async () => {
    vi.stubEnv("SESSION_SECRET", "short"); vi.stubEnv("NODE_ENV", "production");
    const { createSession } = await import("../lib/auth/session");
    await expect(createSession(user)).rejects.toThrow(/at least 32/);
  });

  it("signs with the configured secret, and a token signed with another key does not verify", async () => {
    vi.stubEnv("SESSION_SECRET", "a".repeat(40)); vi.stubEnv("NODE_ENV", "production");
    const { createSession } = await import("../lib/auth/session");
    const { jwtVerify } = await import("jose");
    const token = await createSession(user);
    await expect(jwtVerify(token, new TextEncoder().encode("a".repeat(40)))).resolves.toBeTruthy();
    // the old public fallback must NOT validate real sessions
    await expect(jwtVerify(token, new TextEncoder().encode("temporary_secret_for_build_purposes_only_32_chars"))).rejects.toThrow();
  });

  it("still works in development without a secret", async () => {
    vi.stubEnv("SESSION_SECRET", ""); vi.stubEnv("NODE_ENV", "development");
    const { createSession } = await import("../lib/auth/session");
    await expect(createSession(user)).resolves.toBeTruthy();
  });
});
