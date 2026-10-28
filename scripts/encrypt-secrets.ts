/**
 * Encrypts access tokens that are still stored as plain text (or re-encrypts them after a key
 * rotation). Safe to run repeatedly: values already encrypted with the current key are skipped.
 *
 *   npm run secrets:encrypt              shows what would change, writes nothing
 *   npm run secrets:encrypt -- --yes     does it
 *
 * Needs TOKEN_ENCRYPTION_KEY (and TOKEN_ENCRYPTION_KEY_PREVIOUS when rotating), plus
 * NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Tokens are never printed.
 */
import { createClient } from "@supabase/supabase-js";
import { decryptSecret, encryptSecret, isEncryptionConfigured, needsEncryption } from "../lib/crypto/secrets";

const targets = [
  { table: "wa_connections", column: "access_token" },
  { table: "users", column: "fb_access_token" },
];
const PAGE = 500;
const write = process.argv.includes("--yes");

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("\n✗ Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n"); process.exit(1); }
  if (!isEncryptionConfigured()) { console.error("\n✗ TOKEN_ENCRYPTION_KEY is not set. Generate one with:  openssl rand -base64 32\n"); process.exit(1); }
  const db: any = createClient(url, key, { auth: { persistSession: false } });

  console.log(write ? "\nEncrypting stored tokens\n" : "\nDry run: nothing will be written (add --yes)\n");
  let failed = 0;
  for (const { table, column } of targets) {
    let after = "", scanned = 0, changed = 0;
    for (;;) {
      const { data, error } = await db.from(table).select(`id, ${column}`).gt("id", after).order("id").limit(PAGE);
      if (error) { console.error(`✗ ${table}: ${error.message}`); failed++; break; }
      if (!data?.length) break;
      for (const row of data) {
        scanned++;
        const stored: string = row[column];
        if (!needsEncryption(stored)) continue;
        try {
          const next = encryptSecret(decryptSecret(stored));
          if (write) {
            const { error: e } = await db.from(table).update({ [column]: next }).eq("id", row.id);
            if (e) throw new Error(e.message);
          }
          changed++;
        } catch (e: any) { failed++; console.error(`  ✗ ${table} ${row.id}: ${e.message}`); }
      }
      after = data[data.length - 1].id;
      if (data.length < PAGE) break;
    }
    console.log(`  ${table}.${column}: ${scanned} rows checked, ${changed} ${write ? "encrypted" : "need encrypting"}`);
  }
  console.log(failed ? `\n${failed} problem(s) above.\n` : write ? "\n✓ Done.\n" : "\nRun again with --yes to apply.\n");
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
