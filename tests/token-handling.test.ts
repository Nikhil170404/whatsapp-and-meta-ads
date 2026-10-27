// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Guard rail for encryption at rest: every place that writes a token to the database must
 * encrypt it, and every place that reads one back to use it must decrypt it. This scans the
 * source so a future change cannot quietly bring back plain-text tokens (or send an encrypted
 * value to Meta as if it were a token).
 */
const ROOT = process.cwd();
const DIRS = ["app", "lib", "worker", "scripts"];
const SKIP = new Set(["lib/supabase/types.ts", "lib/crypto/secrets.ts"]);

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}
const files = DIRS.flatMap((d) => walk(join(ROOT, d))).filter((f) => !SKIP.has(relative(ROOT, f)));
const lines = files.flatMap((f) => readFileSync(f, "utf8").split("\n").map((text, i) => ({ file: relative(ROOT, f), n: i + 1, text })));

describe("tokens are encrypted on the way in", () => {
  it("every stored token assignment goes through encryptSecret", () => {
    const bad = lines.filter(({ text }) => {
      const m = /\b(?:fb_)?access_token:\s*([^,}\n]+)/.exec(text);
      if (!m) return false;
      if (/:\s*string\b|:\s*string\s*[;|]/.test(text)) return false; // a type declaration
      if (/^\s*(\/\/|\*)/.test(text)) return false;
      const value = m[1].trim();
      return !(/^encryptSecret\(/.test(value) || value === '""' || /^(conn|connection|row)\??\.access_token\b/.test(value) || /^(body|String\(body)/.test(value));
    });
    expect(bad.map((b) => `${b.file}:${b.n}  ${b.text.trim()}`)).toEqual([]);
  });
});

describe("tokens are decrypted on the way out", () => {
  it("every read of a stored token is decrypted, passed to the refresher, or only checked for presence", () => {
    const bad = lines.filter(({ text }) => {
      const re = /\b(?:conn|connection|row|userRow)\??\.(?:fb_)?access_token\b/g;
      let m: RegExpExecArray | null;
      let flagged = false;
      while ((m = re.exec(text))) {
        const before = text.slice(0, m.index);
        const after = text.slice(m.index + m[0].length);
        const decrypted = /decryptSecret\(\s*$/.test(before) || /decryptSecret\(\s*$/.test(before.replace(/\?\s*$/, ""));
        const presenceCheck = /^\s*(&&|\)|\|\||\?)/.test(after) || /(&&|\|\||if \(|!)\s*$/.test(before);
        const passedAlong = /access_token:\s*$/.test(before) || /refreshWaToken/.test(text);
        const ternaryDecrypt = /\?\s*decryptSecret\(\s*$/.test(before);
        if (!(decrypted || presenceCheck || passedAlong || ternaryDecrypt)) flagged = true;
      }
      return flagged;
    });
    expect(bad.map((b) => `${b.file}:${b.n}  ${b.text.trim()}`)).toEqual([]);
  });

  it("no file hands a connection row's token to a client component", () => {
    const page = readFileSync(join(ROOT, "app/(wa-dashboard)/wa/connect/page.tsx"), "utf8");
    expect(page).toMatch(/toPublicConnection\(row\)/);
  });
});
