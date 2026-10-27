/**
 * Links the WhatsApp number from your environment to a ReplyKaro account, so the dashboard,
 * automations, broadcasts and API work with it without going through Facebook login.
 *
 *   npm run wa:link                              lists accounts and shows what would happen
 *   npm run wa:link -- --user you@example.com --yes
 *
 * Needs WHATSAPP_ACCESS_TOKEN, WHATSAPP_BUSINESS_ACCOUNT_ID (optional WHATSAPP_PHONE_NUMBER_ID),
 * NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Optionally FACEBOOK_APP_ID/SECRET
 * (NEXT_PUBLIC_FACEBOOK_APP_ID) to read the token's expiry. Nothing is written without --yes.
 */
import { createClient } from "@supabase/supabase-js";
import { connectWithCredentials } from "../lib/whatsapp/connect-credentials";

const GRAPH = "https://graph.facebook.com/v25.0";
const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? undefined : process.argv[i + 1]; };
const has = (n: string) => process.argv.includes(`--${n}`);

const token = process.env.WHATSAPP_ACCESS_TOKEN;
const waba = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const stop = (m: string): never => { console.error(`\n✗ ${m}\n`); process.exit(1); };

async function graph(path: string, init?: RequestInit) {
  const res = await fetch(`${GRAPH}/${path}`, {
    ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(20_000),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.error_user_msg || data?.error?.message || `HTTP ${res.status}`);
  return data;
}

async function main() {
  if (!token || !waba) stop("Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_BUSINESS_ACCOUNT_ID first.");
  if (!supaUrl || !supaKey) stop("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  const db: any = createClient(supaUrl!, supaKey!, { auth: { persistSession: false } });

  console.log("\nLink WhatsApp number to a ReplyKaro account\n");

  const phones = (await graph(`${waba}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,messaging_limit_tier`)
    .catch((e) => stop(`Could not read the account from Meta: ${e.message}`))).data ?? [];
  const wanted = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const phone = wanted ? phones.find((p: any) => p.id === wanted) : phones[0];
  if (!phone) stop(wanted ? `Phone number ${wanted} is not on this WhatsApp account.` : "This WhatsApp account has no phone numbers.");
  console.log(`Number:   ${phone.display_phone_number}  "${phone.verified_name ?? ""}"  (${phone.id})`);

  // Token expiry, if we can read it. 0 means it never expires (a System User token).
  let expiresAt: string | null = null;
  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID ?? process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (appId && appSecret) {
    try {
      const r = await fetch(`${GRAPH}/debug_token?input_token=${encodeURIComponent(token!)}&access_token=${appId}|${appSecret}`, { signal: AbortSignal.timeout(15_000) });
      const d: any = (await r.json()).data;
      if (d?.is_valid === false) stop("Meta says this token is not valid. Create a new one.");
      if (d?.expires_at) { expiresAt = new Date(d.expires_at * 1000).toISOString(); console.log(`Token:    expires ${expiresAt} (temporary: replace it before then)`); }
      else if (d) console.log("Token:    does not expire (System User token)");
    } catch { /* optional */ }
  }

  const { data: users } = await db.from("users").select("id, email, display_name, plan_type").order("created_at", { ascending: false }).limit(20);
  const target = arg("user");
  if (!target) {
    console.log("\nAccounts (use --user with the email or id):");
    for (const u of users ?? []) console.log(`  ${u.email ?? "(no email)"}   ${u.display_name ?? ""}   plan=${u.plan_type}   id=${u.id}`);
    console.log("\nRun again with --user <email or id> --yes to link.\n");
    return;
  }
  const { data: found } = await db.from("users").select("id, email, display_name").or(`id.eq.${target},email.eq.${target}`).limit(1).maybeSingle().then((r: any) => r).catch(() => ({ data: null }));
  const user = found ?? (users ?? []).find((u: any) => u.id === target || u.email === target);
  if (!user) stop(`No account matches "${target}".`);
  console.log(`Account:  ${user.email ?? user.display_name} (${user.id})`);

  if (!has("yes")) { console.log("\nNothing written. Add --yes to link this number to that account.\n"); return; }

  const result = await connectWithCredentials(db, user.id, { wabaId: waba!, token: token!, phoneNumberId: wanted }, { appId, appSecret });
  if (!result.ok) stop(result.error);
  const sum = (result as any).data;
  console.log("\n✓ Connection saved.");
  console.log(sum.webhook_subscribed ? "✓ App subscribed to this account's webhooks." : "! Could not subscribe the app to webhooks. Subscribe it in Meta → WhatsApp → Configuration.");
  if (sum.token_expires_warning) console.log(`! ${sum.token_expires_warning}`);
  console.log("\nDone. Open the dashboard: Overview should show this number. Test with: npm run wa:check -- --send --to <number>\n");
}

main().catch((e) => stop(e?.message ?? String(e)));
