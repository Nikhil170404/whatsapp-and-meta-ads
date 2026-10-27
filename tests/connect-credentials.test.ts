import { describe, it, expect, vi } from "vitest";
import { connectWithCredentials, explainGraphError, isAdminEmail, serverCredentials, validateCredentials } from "../lib/whatsapp/connect-credentials";

const TOKEN = "EAAG" + "x".repeat(60);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function fakeDb(upsertError: any = null) {
  const upsert = vi.fn(async () => ({ error: upsertError }));
  return { db: { from: () => ({ upsert }) }, upsert };
}

/** Routes Graph calls by URL like Meta would. */
function meta(handlers: Record<string, () => Response>) {
  return vi.fn(async (url: any) => {
    const u = String(url);
    const key = Object.keys(handlers).find((k) => u.includes(k));
    return key ? handlers[key]() : json({ error: { message: `unexpected ${u}` } }, 500);
  }) as unknown as typeof fetch;
}

const goodMeta = () => meta({
  "/phone_numbers": () => json({ data: [{ id: "111", display_phone_number: "+1 555-672-5793", verified_name: "Test Number", quality_rating: "GREEN", messaging_limit_tier: "TIER_250" }] }),
  "/subscribed_apps": () => json({ success: true }),
  "/message_templates": () => json({ data: [{ status: "APPROVED" }, { status: "APPROVED" }, { status: "PENDING" }] }),
});

describe("validateCredentials", () => {
  it("accepts good input", () => expect(validateCredentials({ wabaId: "2115477789298460", token: TOKEN })).toBeNull());
  it("explains each mistake", () => {
    expect(validateCredentials({ wabaId: "abc", token: TOKEN })).toMatch(/is a number/);
    expect(validateCredentials({ wabaId: "2115477789298460", token: "short" })).toMatch(/whole access token/);
    expect(validateCredentials({ wabaId: "2115477789298460", token: TOKEN + " x" })).toMatch(/without spaces/);
    expect(validateCredentials({ wabaId: "2115477789298460", token: TOKEN, phoneNumberId: "x1" })).toMatch(/Phone number ID/);
  });
});

describe("connectWithCredentials", () => {
  it("verifies with Meta, saves the connection, subscribes webhooks and summarises", async () => {
    const { db, upsert } = fakeDb();
    const r = await connectWithCredentials(db, "u1", { wabaId: "2115477789298460", token: TOKEN }, { fetchImpl: goodMeta() });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toMatchObject({ phone_number: "+1 555-672-5793", quality: "Good", messaging_limit: "250", webhook_subscribed: true, looks_like_test_number: true, templates: { approved: 2, total: 3 } });
    expect(upsert).toHaveBeenCalledOnce();
    const row = (upsert.mock.calls[0] as any)[0];
    expect(row).toMatchObject({ user_id: "u1", phone_number_id: "111", waba_id: "2115477789298460", status: "active" });
  });

  it("never returns the token", async () => {
    const r = await connectWithCredentials(fakeDb().db, "u1", { wabaId: "2115477789298460", token: TOKEN }, { fetchImpl: goodMeta() });
    expect(JSON.stringify(r)).not.toContain(TOKEN);
  });

  it("does not save anything when Meta rejects the token", async () => {
    const { db, upsert } = fakeDb();
    const f = meta({ "/phone_numbers": () => json({ error: { code: 190, message: "Invalid OAuth access token" } }, 400) });
    const r = await connectWithCredentials(db, "u1", { wabaId: "2115477789298460", token: TOKEN }, { fetchImpl: f });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/invalid or has expired/);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("reports a number that is already connected to someone else", async () => {
    const r = await connectWithCredentials(fakeDb({ message: "duplicate key value violates unique constraint" }).db, "u1", { wabaId: "2115477789298460", token: TOKEN }, { fetchImpl: goodMeta() });
    expect(r.ok).toBe(false);
    if (!r.ok) expect([r.status, r.error]).toEqual([409, expect.stringMatching(/different ReplyKaro account/)]);
  });

  it("rejects a phone number that is not on the account", async () => {
    const r = await connectWithCredentials(fakeDb().db, "u1", { wabaId: "2115477789298460", token: TOKEN, phoneNumberId: "999" }, { fetchImpl: goodMeta() });
    expect(r.ok).toBe(false);
  });

  it("warns when the token is temporary", async () => {
    const f = meta({
      "/debug_token": () => json({ data: { is_valid: true, expires_at: Math.floor(Date.now() / 1000) + 86400 } }),
      "/phone_numbers": () => json({ data: [{ id: "111", display_phone_number: "+91 99999 99999", verified_name: "Shop" }] }),
      "/subscribed_apps": () => json({ success: true }),
      "/message_templates": () => json({ data: [] }),
    });
    const r = await connectWithCredentials(fakeDb().db, "u1", { wabaId: "2115477789298460", token: TOKEN }, { fetchImpl: f, appId: "1", appSecret: "s" });
    expect(r.ok && r.data.token_expires_warning).toMatch(/temporary token/);
  });

  it("still saves when webhook subscription fails, and says so", async () => {
    const f = meta({
      "/phone_numbers": () => json({ data: [{ id: "111", display_phone_number: "+91 99999 99999" }] }),
      "/subscribed_apps": () => json({ error: { message: "nope" } }, 400),
      "/message_templates": () => json({ data: [] }),
    });
    const r = await connectWithCredentials(fakeDb().db, "u1", { wabaId: "2115477789298460", token: TOKEN }, { fetchImpl: f });
    expect(r.ok && r.data.webhook_subscribed).toBe(false);
  });
});

describe("admin-only server credentials", () => {
  it("only listed emails qualify", () => {
    expect(isAdminEmail("me@x.com", "me@x.com, you@y.com")).toBe(true);
    expect(isAdminEmail("ME@X.COM", "me@x.com")).toBe(true);
    expect(isAdminEmail("stranger@x.com", "me@x.com")).toBe(false);
    expect(isAdminEmail("me@x.com", undefined)).toBe(false);
    expect(isAdminEmail(null, "me@x.com")).toBe(false);
  });
  it("reads the server credentials only when both are set", () => {
    expect(serverCredentials({ WHATSAPP_BUSINESS_ACCOUNT_ID: "123456", WHATSAPP_ACCESS_TOKEN: TOKEN } as any)).toMatchObject({ wabaId: "123456" });
    expect(serverCredentials({ WHATSAPP_ACCESS_TOKEN: TOKEN } as any)).toBeNull();
  });
});

describe("explainGraphError", () => {
  it("covers the common Meta errors", () => {
    expect(explainGraphError(190, "x")).toMatch(/expired/);
    expect(explainGraphError(100, "x")).toMatch(/Business Account ID/);
    expect(explainGraphError(200, "x")).toMatch(/permission/);
  });
});
