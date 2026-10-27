// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const schema = readFileSync(join(process.cwd(), "supabase/schema.sql"), "utf8");

describe("supabase/schema.sql", () => {
  let db: PGlite;
  let userId: string;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(schema);
    userId = (await db.query<{ id: string }>("insert into users(facebook_user_id) values('fb1') returning id")).rows[0].id;
  });

  it("is idempotent", async () => {
    await expect(db.exec(schema)).resolves.not.toThrow();
  });

  it("defaults new accounts to the free plan", async () => {
    const r = await db.query<{ plan_type: string }>("select plan_type from users where id = $1", [userId]);
    expect(r.rows[0].plan_type).toBe("free");
  });

  it("enables row level security on every table", async () => {
    const r = await db.query<{ n: number }>("select count(*)::int n from pg_tables where schemaname='public' and not rowsecurity");
    expect(r.rows[0].n).toBe(0);
  });

  it("rejects duplicate webhook message ids", async () => {
    await expect(
      db.query(
        "insert into wa_messages(user_id,wa_message_id,to_phone,direction) values($1,'x','1','inbound'),($1,'x','1','inbound')",
        [userId]
      )
    ).rejects.toThrow();
  });

  it("keeps consent logs append-only but lets a contact be erased", async () => {
    const c = (await db.query<{ id: string }>("insert into wa_contacts(user_id,phone_number) values($1,'+911') returning id", [userId])).rows[0];
    await db.query("insert into wa_consent_logs(user_id,contact_id,phone_number,action,source) values($1,$2,'+911','granted','test')", [userId, c.id]);
    await expect(db.query("update wa_consent_logs set action='withdrawn'")).rejects.toThrow(/append-only/);
    await expect(db.query("delete from wa_contacts where id=$1", [c.id])).resolves.toBeDefined();
  });

  it("counts broadcast receipts once per step", async () => {
    const t = (await db.query<{ id: string }>("insert into wa_templates(user_id,name,body_text) values($1,'t','hi') returning id", [userId])).rows[0];
    const b = (await db.query<{ id: string }>("insert into wa_broadcasts(user_id,name,template_id) values($1,'b',$2) returning id", [userId, t.id])).rows[0];
    const c = (await db.query<{ id: string }>("insert into wa_contacts(user_id,phone_number) values($1,'+922') returning id", [userId])).rows[0];
    await db.query("insert into wa_broadcast_recipients(broadcast_id,contact_id,status,wa_message_id) values($1,$2,'sent','wamid.1')", [b.id, c.id]);
    for (const s of ["delivered", "read", "delivered", "read"]) {
      await db.query("select apply_broadcast_receipt('wamid.1',$1)", [s]);
    }
    const r = await db.query<{ d: number; r: number }>("select delivered_count d, read_count r from wa_broadcasts where id=$1", [b.id]);
    expect(r.rows[0]).toEqual({ d: 1, r: 1 });
  });

  it("lets only one worker replica hold a job lock", async () => {
    const a = await db.query<{ v: boolean }>("select try_acquire_worker_lock('job','a',60) v");
    const b = await db.query<{ v: boolean }>("select try_acquire_worker_lock('job','b',60) v");
    expect([a.rows[0].v, b.rows[0].v]).toEqual([true, false]);
  });
});

describe("template and broadcast columns", () => {
  it("stores structured templates and broadcast variable plans", async () => {
    const db = new PGlite();
    await db.exec(schema);
    const u = (await db.query<{ id: string }>("insert into users(facebook_user_id) values('fb9') returning id")).rows[0];
    // OTP templates have no body text of their own.
    await db.query("insert into wa_templates(user_id,name,category,template_type) values($1,'otp','AUTHENTICATION','otp')", [u.id]);
    const t = (await db.query<{ id: string }>(
      "insert into wa_templates(user_id,name,body_text,header_text,footer_text,buttons,examples) values($1,'promo','Hi {{1}}, sale ends soon','H','F','[{\"type\":\"QUICK_REPLY\",\"text\":\"Yes\"}]','[\"Rahul\"]') returning id", [u.id])).rows[0];
    await db.query("insert into wa_broadcasts(user_id,name,template_id,variables) values($1,'b',$2,'[{\"source\":\"name\"}]')", [u.id, t.id]);
    const r = await db.query<{ n: number }>("select count(*)::int n from wa_broadcasts where variables is not null");
    expect(r.rows[0].n).toBe(1);
  });
});

describe("phone format migration", () => {
  it("merges '+91…' and '91…' contacts, keeping any opt-out and combined labels", async () => {
    const db = new PGlite();
    await db.exec(schema);
    const u = (await db.query<{ id: string }>("insert into users(facebook_user_id) values('fbp') returning id")).rows[0];
    const plus = (await db.query<{ id: string }>(
      "insert into wa_contacts(user_id,phone_number,labels,is_opted_in) values($1,'+919876543210','{vip}',false) returning id", [u.id])).rows[0];
    await db.query("insert into wa_contacts(user_id,phone_number,labels,is_opted_in) values($1,'919876543210','{lead}',true)", [u.id]);
    await db.query("insert into wa_contacts(user_id,phone_number) values($1,'+911111111111')", [u.id]);
    await db.query("insert into wa_consent_logs(user_id,contact_id,phone_number,action,source) values($1,$2,'+919876543210','withdrawn','test')", [u.id, plus.id]);

    await db.exec(schema); // re-running the schema performs the merge

    const rows = (await db.query<{ phone_number: string; labels: string[]; is_opted_in: boolean }>(
      "select phone_number, labels, is_opted_in from wa_contacts order by phone_number")).rows;
    expect(rows.map((r) => r.phone_number)).toEqual(["911111111111", "919876543210"]);
    const merged = rows.find((r) => r.phone_number === "919876543210")!;
    expect(merged.is_opted_in).toBe(false);
    expect([...merged.labels].sort()).toEqual(["lead", "vip"]);
    // The consent history now points at the surviving contact instead of being orphaned.
    const logs = await db.query<{ contact_id: string | null }>("select contact_id from wa_consent_logs");
    expect(logs.rows[0].contact_id).not.toBeNull();
  });
});

describe("broadcast engine functions", () => {
  async function setup() {
    const db = new PGlite();
    await db.exec(schema);
    const u = (await db.query<{ id: string }>("insert into users(facebook_user_id) values('fbe') returning id")).rows[0];
    const t = (await db.query<{ id: string }>("insert into wa_templates(user_id,name,body_text,category) values($1,'t','hi there friend','MARKETING') returning id", [u.id])).rows[0];
    // 1,000 contacts: 900 consenting, 50 opted out, 50 service-only (no marketing consent), 100 labelled vip
    await db.query(
      `insert into wa_contacts(user_id, phone_number, is_opted_in, consent_purposes, labels)
       select $1, '91' || lpad(g::text, 10, '0'),
              g > 50,
              CASE WHEN g > 100 AND g <= 150 THEN ARRAY['service_messages'] ELSE ARRAY['service_messages','marketing_messages'] END,
              CASE WHEN g % 10 = 0 THEN ARRAY['vip'] ELSE '{}' END
       from generate_series(1, 1000) g`, [u.id]);
    const b = (await db.query<{ id: string }>("insert into wa_broadcasts(user_id,name,template_id,status) values($1,'b',$2,'queued') returning id", [u.id, t.id])).rows[0];
    return { db, u, b };
  }

  it("adds recipients for all contacts in one statement, or by label", async () => {
    const { db, u, b } = await setup();
    const all = await db.query<{ add_broadcast_recipients: number }>("select add_broadcast_recipients($1,$2,null,null,true)", [b.id, u.id]);
    expect(all.rows[0].add_broadcast_recipients).toBe(1000);
    // adding again does not duplicate
    expect((await db.query<{ n: number }>("select add_broadcast_recipients($1,$2,null,null,true) n", [b.id, u.id])).rows[0].n).toBe(1000);

    const b2 = (await db.query<{ id: string }>("insert into wa_broadcasts(user_id,name,status) values($1,'b2','draft') returning id", [u.id])).rows[0];
    expect((await db.query<{ n: number }>("select add_broadcast_recipients($1,$2,null,'vip',false) n", [b2.id, u.id])).rows[0].n).toBe(100);
  });

  it("skips opted-out and non-marketing contacts, then caps to the daily limit", async () => {
    const { db, u, b } = await setup();
    await db.query("select add_broadcast_recipients($1,$2,null,null,true)", [b.id, u.id]);
    const r = (await db.query<{ skip_ineligible_recipients: { opted_out: number; no_marketing_consent: number } }>("select skip_ineligible_recipients($1,true)", [b.id])).rows[0].skip_ineligible_recipients;
    expect(r).toEqual({ opted_out: 50, no_marketing_consent: 50 });
    const left = (await db.query<{ n: number }>("select count(*)::int n from wa_broadcast_recipients where broadcast_id=$1 and status='pending'", [b.id])).rows[0].n;
    expect(left).toBe(900);
    expect((await db.query<{ n: number }>("select limit_broadcast_recipients($1, 700, 'limit') n", [b.id])).rows[0].n).toBe(200);
    expect((await db.query<{ n: number }>("select count(*)::int n from wa_broadcast_recipients where broadcast_id=$1 and status='pending'", [b.id])).rows[0].n).toBe(700);
  });

  it("hands out each recipient exactly once, records results in bulk, and resumes after a crash", async () => {
    const { db, u, b } = await setup();
    await db.query("select add_broadcast_recipients($1,$2,null,null,true)", [b.id, u.id]);
    expect((await db.query<{ claim_broadcast: boolean }>("select claim_broadcast($1)", [b.id])).rows[0].claim_broadcast).toBe(true);
    // a second worker cannot take a live broadcast
    expect((await db.query<{ claim_broadcast: boolean }>("select claim_broadcast($1)", [b.id])).rows[0].claim_broadcast).toBe(false);

    const c1 = (await db.query<{ recipient_id: string }>("select * from next_broadcast_chunk($1, 300)", [b.id])).rows;
    const c2 = (await db.query<{ recipient_id: string }>("select * from next_broadcast_chunk($1, 300)", [b.id])).rows;
    expect(c1.length).toBe(300);
    expect(new Set([...c1, ...c2].map((r) => r.recipient_id)).size).toBe(600); // no overlap

    const results = c1.map((r, i) => ({ id: r.recipient_id, status: i < 290 ? "sent" : "failed", wamid: i < 290 ? `wamid.${i}` : null, error: i < 290 ? null : "boom" }));
    await db.query("select record_recipient_results($1, $2::jsonb)", [b.id, JSON.stringify(results)]);
    const counts = (await db.query<{ sent_count: number; failed_count: number }>("select sent_count, failed_count from wa_broadcasts where id=$1", [b.id])).rows[0];
    expect(counts).toEqual({ sent_count: 290, failed_count: 10 });

    // worker crashes: heartbeat goes stale, another worker resumes; in-flight (c2) goes back in line
    await db.query("update wa_broadcasts set locked_at = now() - interval '10 minutes' where id=$1", [b.id]);
    expect((await db.query<{ claim_broadcast: boolean }>("select claim_broadcast($1, 120)", [b.id])).rows[0].claim_broadcast).toBe(true);
    const progress = (await db.query<{ broadcast_progress: Record<string, number> }>("select broadcast_progress($1)", [b.id])).rows[0].broadcast_progress;
    expect(progress.sent).toBe(290);
    expect(progress.sending).toBeUndefined();
    expect(progress.pending).toBe(1000 - 300);
  });
});

describe("limit and audience functions", () => {
  it("counts distinct customers messaged in a rolling 24 hours (Meta's limit), not calendar days", async () => {
    const db = new PGlite();
    await db.exec(schema);
    const u = (await db.query<{ id: string }>("insert into users(facebook_user_id) values('fbl') returning id")).rows[0];
    const t = (await db.query<{ id: string }>("insert into wa_templates(user_id,name,body_text) values($1,'t','hello there friend') returning id", [u.id])).rows[0];
    const b1 = (await db.query<{ id: string }>("insert into wa_broadcasts(user_id,name,template_id) values($1,'a',$2) returning id", [u.id, t.id])).rows[0];
    const b2 = (await db.query<{ id: string }>("insert into wa_broadcasts(user_id,name,template_id) values($1,'b',$2) returning id", [u.id, t.id])).rows[0];
    const c: string[] = [];
    for (let i = 0; i < 4; i++) c.push((await db.query<{ id: string }>("insert into wa_contacts(user_id,phone_number) values($1,$2) returning id", [u.id, `9100000000${i}`])).rows[0].id);
    // contact 0 messaged by BOTH broadcasts within 24h (counts once), contact 1 within 24h, contact 2 messaged 30h ago (does not count), contact 3 failed
    await db.query("insert into wa_broadcast_recipients(broadcast_id,contact_id,status,sent_at) values($1,$2,'sent',now() - interval '2 hours'), ($1,$3,'delivered',now() - interval '5 hours'), ($1,$4,'sent',now() - interval '30 hours'), ($1,$5,'failed',now() - interval '1 hour')", [b1.id, c[0], c[1], c[2], c[3]]);
    await db.query("insert into wa_broadcast_recipients(broadcast_id,contact_id,status,sent_at) values($1,$2,'sent',now() - interval '1 hour')", [b2.id, c[0]]);
    expect((await db.query<{ n: number }>("select unique_template_recipients_24h($1) n", [u.id])).rows[0].n).toBe(2);
  });

  it("previews an audience and lists labels without loading contacts", async () => {
    const db = new PGlite();
    await db.exec(schema);
    const u = (await db.query<{ id: string }>("insert into users(facebook_user_id) values('fba') returning id")).rows[0];
    await db.query(`insert into wa_contacts(user_id, phone_number, is_opted_in, consent_purposes, labels)
      values ($1,'911',true,'{service_messages,marketing_messages}','{vip}'), ($1,'912',false,'{service_messages}','{vip}'), ($1,'913',true,'{service_messages}','{lead}')`, [u.id]);
    const p = (await db.query<{ audience_preview: any }>("select audience_preview($1,null,null,true,true)", [u.id])).rows[0].audience_preview;
    expect(p).toEqual({ selected: 3, opted_out: 1, no_marketing_consent: 1, will_send: 1 });
    const vip = (await db.query<{ audience_preview: any }>("select audience_preview($1,null,'vip',false,false)", [u.id])).rows[0].audience_preview;
    expect(vip).toMatchObject({ selected: 2, will_send: 1 });
    expect((await db.query<{ l: string[] }>("select distinct_contact_labels($1) l", [u.id])).rows[0].l).toEqual(["lead", "vip"]);
  });
});

describe("scale helpers", () => {
  it("counts messages per day in the database, zero-filled and time-zone aware", async () => {
    const db = new PGlite();
    await db.exec(schema);
    const u = (await db.query<{ id: string }>("insert into users(facebook_user_id) values('fbm') returning id")).rows[0];
    await db.query(`insert into wa_messages(user_id,to_phone,direction,created_at)
      select $1,'1', CASE WHEN g % 3 = 0 THEN 'inbound' ELSE 'outbound' END, now() - (g || ' minutes')::interval from generate_series(1, 3000) g`, [u.id]);
    const rows = (await db.query<{ day: string; inbound: number; outbound: number }>("select * from message_daily_counts($1, 7, 'UTC')", [u.id])).rows;
    expect(rows).toHaveLength(7);
    // 3,000 rows is beyond the 1,000-row cap that used to truncate the dashboard's counts
    expect(rows.reduce((n, r) => n + r.inbound + r.outbound, 0)).toBe(3000);
    expect(rows[0].inbound + rows[0].outbound).toBe(0); // a quiet day is present as zero, not missing
  });

  it("purges expired messages in batches and keeps recent ones", async () => {
    const db = new PGlite();
    await db.exec(schema);
    const u = (await db.query<{ id: string }>("insert into users(facebook_user_id) values('fbq') returning id")).rows[0];
    await db.query("insert into wa_messages(user_id,to_phone,direction,created_at) select $1,'1','inbound', now() - interval '120 days' from generate_series(1, 2500)", [u.id]);
    await db.query("insert into wa_messages(user_id,to_phone,direction,created_at) select $1,'1','inbound', now() - interval '5 days' from generate_series(1, 100)", [u.id]);
    const first = (await db.query<{ n: number }>("select purge_old_wa_messages_batch(90, 1000) n")).rows[0].n;
    const second = (await db.query<{ n: number }>("select purge_old_wa_messages_batch(90, 1000) n")).rows[0].n;
    const third = (await db.query<{ n: number }>("select purge_old_wa_messages_batch(90, 1000) n")).rows[0].n;
    const fourth = (await db.query<{ n: number }>("select purge_old_wa_messages_batch(90, 1000) n")).rows[0].n;
    expect([first, second, third, fourth]).toEqual([1000, 1000, 500, 0]);
    expect((await db.query<{ n: number }>("select count(*)::int n from wa_messages")).rows[0].n).toBe(100);
  });
});

describe("webhook queue", () => {
  it("hands each event to one worker, retries failures, parks poison events, and drops payloads when done", async () => {
    const db = new PGlite();
    await db.exec(schema);
    await db.query("insert into wa_webhook_events(payload) select jsonb_build_object('n', g) from generate_series(1, 120) g");

    const a = (await db.query<{ id: number }>("select * from claim_webhook_events(50, 120)")).rows;
    const b = (await db.query<{ id: number }>("select * from claim_webhook_events(50, 120)")).rows;
    expect(a).toHaveLength(50);
    expect(new Set([...a, ...b].map((r) => r.id)).size).toBe(100); // no event handed out twice

    // success: marked done and the customer payload is erased
    await db.query("select finish_webhook_event($1, null)", [a[0].id]);
    const done = (await db.query<{ status: string; payload: any }>("select status, payload from wa_webhook_events where id=$1", [a[0].id])).rows[0];
    expect(done.status).toBe("done");
    expect(done.payload).toEqual({});

    // failure: back in line, then parked after 5 attempts
    const victim = a[1].id;
    await db.query("select finish_webhook_event($1, 'boom')", [victim]);
    expect((await db.query<{ status: string }>("select status from wa_webhook_events where id=$1", [victim])).rows[0].status).toBe("pending");
    for (let i = 0; i < 4; i++) {
      await db.query("select * from claim_webhook_events(1000, 120)"); // re-claims (attempts goes up)
      await db.query("select finish_webhook_event($1, 'boom')", [victim]);
    }
    expect((await db.query<{ status: string }>("select status from wa_webhook_events where id=$1", [victim])).rows[0].status).toBe("dead");

    // a worker that died: its stale "processing" events are handed out again
    await db.query("update wa_webhook_events set locked_at = now() - interval '10 minutes' where status = 'processing'");
    expect((await db.query("select * from claim_webhook_events(10, 120)")).rows.length).toBeGreaterThan(0);
  });
});
