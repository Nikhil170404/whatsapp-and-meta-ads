// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { signBody, signedHeaders, verifySignature, isSafeComUrl } from "@/lib/bridge/signing";
import { parsePause, isPausedNow } from "@/lib/bridge/pause";
import { inboundEvent } from "@/lib/bridge/events";
import { authenticateBridge } from "@/lib/bridge/auth";
import { pushDue } from "@/lib/bridge/push";
import { encryptSecret } from "@/lib/crypto/secrets";

describe("bridge signing", () => {
  const body = JSON.stringify({ type: "message.inbound", dedupe_key: "k" });
  it("round-trips the same way .com signs", () => {
    const h = signedHeaders("link1", "s".repeat(32), body);
    expect(verifySignature({ secret: "s".repeat(32), timestamp: h["x-rk-timestamp"], signature: h["x-rk-signature"], rawBody: body })).toBe(true);
  });
  it("rejects a wrong secret, a changed body, and an old timestamp", () => {
    const h = signedHeaders("link1", "a".repeat(32), body);
    const ok = { timestamp: h["x-rk-timestamp"], signature: h["x-rk-signature"] };
    expect(verifySignature({ secret: "b".repeat(32), ...ok, rawBody: body })).toBe(false);
    expect(verifySignature({ secret: "a".repeat(32), ...ok, rawBody: body + " " })).toBe(false);
    expect(verifySignature({ secret: "a".repeat(32), ...ok, rawBody: body, nowMs: Date.now() + 10 * 60_000 })).toBe(false);
    expect(verifySignature({ secret: "a".repeat(32), timestamp: ok.timestamp, signature: "zz", rawBody: body })).toBe(false);
  });
  it("matches the documented algorithm", () => {
    expect(signBody("k", 1700000000, "{}")).toMatch(/^[0-9a-f]{64}$/);
  });
  it("only accepts https addresses", () => {
    expect(isSafeComUrl("https://www.replykaro.com/api/webhooks/wa-bridge")).toBe(true);
    expect(isSafeComUrl("http://evil.example/x")).toBe(false);
    expect(isSafeComUrl("https://user:pw@x.com/")).toBe(false);
    expect(isSafeComUrl("http://localhost:3000/x")).toBe(true);
  });
});

describe("pause", () => {
  const now = Date.parse("2026-11-05T10:00:00Z");
  it("parses pause and resume", () => {
    expect(parsePause({ wa_id: "9198", paused: false }, now)).toEqual({ waId: "9198", until: null });
    expect(parsePause({ wa_id: "9198", paused: true, until: "2026-11-05T22:00:00Z" }, now)?.until).toBe("2026-11-05T22:00:00.000Z");
  });
  it("defaults to 12 hours and caps at 30 days", () => {
    expect(parsePause({ wa_id: "1", paused: true }, now)?.until).toBe(new Date(now + 12 * 3600_000).toISOString());
    expect(parsePause({ wa_id: "1", paused: true, until: "2030-01-01T00:00:00Z" }, now)?.until).toBe(new Date(now + 30 * 24 * 3600_000).toISOString());
    expect(parsePause({ wa_id: "1", paused: true, until: "2020-01-01T00:00:00Z" }, now)?.until).toBe(new Date(now + 12 * 3600_000).toISOString());
  });
  it("rejects bad bodies and checks expiry", () => {
    expect(parsePause({ paused: true }, now)).toBeNull();
    expect(parsePause({ wa_id: "1", paused: "yes" }, now)).toBeNull();
    expect(isPausedNow("2026-11-05T11:00:00Z", now)).toBe(true);
    expect(isPausedNow("2026-11-05T09:00:00Z", now)).toBe(false);
    expect(isPausedNow(null, now)).toBe(false);
  });
});

describe("inbound event shape", () => {
  it("matches what .com parses", () => {
    expect(inboundEvent({ waId: "919876543210", name: "Riya", text: "hello", at: "2026-11-04T10:00:00Z" })).toEqual({ wa_id: "919876543210", name: "Riya", phone: "919876543210", text: "hello", at: "2026-11-04T10:00:00Z" });
  });
});

describe("authenticateBridge", () => {
  const secret = "x".repeat(40);
  const fakeDb = (link: any) => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: link }) }) }) }) });
  const req = (body: string, headers: Record<string, string>) => new Request("https://x/api/bridge/send", { method: "POST", body, headers });
  it("accepts a good request and finds the account", async () => {
    const body = JSON.stringify({ wa_id: "1" });
    const r = await authenticateBridge(fakeDb({ user_id: "u1", signing_secret: secret, status: "active" }), req(body, signedHeaders("L", secret, body)));
    expect(r).toMatchObject({ ok: true, userId: "u1" });
  });
  it("rejects unknown, revoked and badly signed links", async () => {
    const body = "{}";
    expect(await authenticateBridge(fakeDb(null), req(body, signedHeaders("L", secret, body)))).toMatchObject({ ok: false, status: 401 });
    expect(await authenticateBridge(fakeDb({ user_id: "u", signing_secret: secret, status: "revoked" }), req(body, signedHeaders("L", secret, body)))).toMatchObject({ ok: false, status: 401 });
    expect(await authenticateBridge(fakeDb({ user_id: "u", signing_secret: secret, status: "active" }), req(body, signedHeaders("L", "y".repeat(40), body)))).toMatchObject({ ok: false, status: 401 });
    expect(await authenticateBridge(fakeDb({ user_id: "u", signing_secret: secret, status: "active" }), req(body, {}))).toMatchObject({ ok: false, status: 401 });
  });
});

describe("supabase/unified-bridge.sql", () => {
  const schema = readFileSync(join(process.cwd(), "supabase/schema.sql"), "utf8");
  const bridge = readFileSync(join(process.cwd(), "supabase/unified-bridge.sql"), "utf8");
  let db: PGlite;
  let userId: string;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(schema);
    await db.exec(bridge);
    userId = (await db.query<{ id: string }>("insert into users(facebook_user_id) values('fb9') returning id")).rows[0].id;
  });

  it("is idempotent and keeps row level security on", async () => {
    await expect(db.exec(bridge)).resolves.not.toThrow();
    const r = await db.query<{ n: number }>("select count(*)::int n from pg_tables where schemaname='public' and not rowsecurity");
    expect(r.rows[0].n).toBe(0);
  });

  it("queues nothing until the account is linked", async () => {
    await db.query("select bridge_enqueue($1,'message.inbound','a','{}'::jsonb)", [userId]);
    expect((await db.query<{ n: number }>("select count(*)::int n from bridge_outbox")).rows[0].n).toBe(0);
    await db.query("insert into bridge_links(user_id,link_id,com_url,signing_secret) values($1,'L1','https://c/x','sec')", [userId]);
    await db.query("select bridge_enqueue($1,'message.inbound','a','{\"wa_id\":\"1\"}'::jsonb)", [userId]);
    await db.query("select bridge_enqueue($1,'message.inbound','a','{}'::jsonb)", [userId]); // repeat is ignored
    expect((await db.query<{ n: number }>("select count(*)::int n from bridge_outbox")).rows[0].n).toBe(1);
  });

  it("queues outbound messages by trigger, but not ones .com sent", async () => {
    await db.query("insert into wa_messages(user_id,wa_message_id,to_phone,direction,content) values($1,'w1','919800000001','outbound','auto reply')", [userId]);
    await db.query("insert into wa_messages(user_id,wa_message_id,to_phone,direction,content,origin) values($1,'w2','919800000001','outbound','typed here','dashboard')", [userId]);
    await db.query("insert into wa_messages(user_id,wa_message_id,to_phone,direction,content,origin) values($1,'w3','919800000001','outbound','from com','bridge')", [userId]);
    await db.query("insert into wa_messages(user_id,wa_message_id,from_phone,to_phone,direction,content) values($1,'w4','919800000001','919800000009','inbound','hi')", [userId]);
    const r = await db.query<{ dedupe_key: string; payload: any }>("select dedupe_key, payload from bridge_outbox where event_type='message.outbound' order by id");
    expect(r.rows.map((x) => x.dedupe_key)).toEqual(["out:w1", "out:w2"]);
    expect(r.rows[0].payload.data.by).toBe("automation");
    expect(r.rows[1].payload.data.by).toBe("teammate");
  });

  it("claims, retries with backoff, and parks dead events", async () => {
    const claimed = await db.query<{ id: number; attempts: number }>("select * from bridge_claim(10, 60)");
    expect(claimed.rows.length).toBe(3);
    expect(claimed.rows[0].attempts).toBe(1);
    expect((await db.query("select * from bridge_claim(10, 60)")).rows.length).toBe(0); // leased
    const [a, b, c] = claimed.rows.map((x) => x.id);
    await db.query("select bridge_finish($1,'ok')", [a]);
    await db.query("select bridge_finish($1,'retry','HTTP 500')", [b]);
    await db.query("select bridge_finish($1,'dead','401')", [c]);
    const st = await db.query<{ delivered: boolean; due: boolean; err: string }>("select delivered_at is not null delivered, next_attempt_at <= now() due, last_error err from bridge_outbox order by id");
    expect(st.rows[0].delivered).toBe(true);
    expect(st.rows[1]).toMatchObject({ delivered: false, due: false, err: "HTTP 500" });
    expect(st.rows[2].due).toBe(false);
    expect(Number((await db.query<{ n: number }>("select bridge_purge(7) n")).rows[0].n)).toBe(0);
  });
});

describe("pushDue", () => {
  const rows = [{ id: 1, user_id: "u", attempts: 1, payload: { type: "message.inbound", dedupe_key: "k", data: {} } }];
  function db(link: any) {
    const finished: any[] = [];
    const linkUpdates: any[] = [];
    return {
      finished, linkUpdates,
      rpc: async (fn: string, args: any) => { if (fn === "bridge_claim") return { data: rows, error: null }; finished.push(args); return { data: null, error: null }; },
      from: () => ({
        select: () => ({ in: async () => ({ data: link ? [link] : [] }) }),
        update: (v: any) => ({ eq: async () => { linkUpdates.push(v); return {}; } }),
      }),
    };
  }
  const link = { user_id: "u", link_id: "L", com_url: "https://c/x", signing_secret: "s".repeat(32), status: "active" };
  it("delivers a signed event", async () => {
    const d = db(link);
    let seen: any;
    const s = await pushDue(d, (async (url: string, init: any) => { seen = { url, init }; return new Response("{}", { status: 200 }); }) as any);
    expect(s.delivered).toBe(1);
    expect(d.finished[0].p_outcome).toBe("ok");
    expect(seen.init.headers["x-rk-link"]).toBe("L");
    expect(verifySignature({ secret: "s".repeat(32), timestamp: seen.init.headers["x-rk-timestamp"], signature: seen.init.headers["x-rk-signature"], rawBody: seen.init.body })).toBe(true);
  });
  it("retries on 500 and on network errors", async () => {
    const d = db(link);
    expect((await pushDue(d, (async () => new Response("", { status: 500 })) as any)).retried).toBe(1);
    const d2 = db(link);
    expect((await pushDue(d2, (async () => { throw new Error("offline"); }) as any)).retried).toBe(1);
    expect(d2.finished[0]).toMatchObject({ p_outcome: "retry", p_error: "offline" });
  });
  it("parks 401 and marks the link as broken; parks events of a revoked link", async () => {
    const d = db(link);
    expect((await pushDue(d, (async () => new Response("", { status: 401 })) as any)).dead).toBe(1);
    expect(d.linkUpdates[0].status).toBe("error");
    const d2 = db({ ...link, status: "revoked" });
    expect((await pushDue(d2, (async () => new Response("", { status: 200 })) as any)).dead).toBe(1);
  });
  it("reads an encrypted secret", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const d = db({ ...link, signing_secret: encryptSecret("s".repeat(32)) });
    let seen: any;
    await pushDue(d, (async (_u: string, init: any) => { seen = init; return new Response("{}"); }) as any);
    expect(verifySignature({ secret: "s".repeat(32), timestamp: seen.headers["x-rk-timestamp"], signature: seen.headers["x-rk-signature"], rawBody: seen.body })).toBe(true);
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });
});

import { allowedComOrigins, connectPath, isSafeAfterLogin, isValidCode, trustedOrigin } from "@/lib/bridge/connect";

describe("one-click connect safety", () => {
  const code = "A".repeat(43);
  it("trusts only listed .com addresses", () => {
    expect(trustedOrigin("https://www.replykaro.com/dashboard/u/channels?x=1", {})).toBe("https://www.replykaro.com");
    expect(trustedOrigin("https://evil.example/dashboard", {})).toBeNull();
    expect(trustedOrigin("https://www.replykaro.com.evil.example/x", {})).toBeNull();
    expect(trustedOrigin("http://www.replykaro.com/x", {})).toBeNull();
    expect(trustedOrigin("https://u:p@www.replykaro.com/x", {})).toBeNull();
    expect(trustedOrigin("javascript:alert(1)", {})).toBeNull();
    expect(trustedOrigin(undefined, {})).toBeNull();
  });
  it("can be pointed at another address by env", () => {
    expect(allowedComOrigins({ UNIFIED_COM_ORIGINS: "https://app.example.com/, https://b.example" })).toEqual(["https://app.example.com", "https://b.example"]);
    expect(trustedOrigin("https://app.example.com/x", { UNIFIED_COM_ORIGINS: "https://app.example.com" })).toBe("https://app.example.com");
  });
  it("accepts only well-formed codes", () => {
    expect(isValidCode(code)).toBe(true);
    for (const v of ["", "short", "a/b".padEnd(40, "a"), null, "x".repeat(70)]) expect(isValidCode(v)).toBe(false);
  });
  it("only lets the connect page be a post-login landing page", () => {
    expect(isSafeAfterLogin(connectPath(code, "https://www.replykaro.com/dashboard/u/channels"))).toBe(true);
    for (const v of ["/wa", "//evil.example", "https://evil.example/wa/unified/connect?x=1", "/wa/unified/connect?code=x//evil", "/wa/unified/connect?\\evil", undefined]) expect(isSafeAfterLogin(v)).toBe(false);
  });
});
