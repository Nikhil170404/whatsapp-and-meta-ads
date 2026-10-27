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
