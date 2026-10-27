import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { applyFix, defaultExamples, validateTemplate } from "../lib/whatsapp/template-builder";

// Pull the built-in library out of the client component source.
const src = readFileSync("app/(wa-dashboard)/wa/templates/TemplatesClient.tsx", "utf8");
const entries = [...src.matchAll(/label: "([^"]+)", category: "(MARKETING|UTILITY)", text: "((?:[^"\\]|\\.)*)"/g)].map((m) => ({
  label: m[1], category: m[2] as "MARKETING" | "UTILITY", text: JSON.parse(`"${m[3]}"`) as string,
}));

function autofix(text: string) {
  for (let i = 0; i < 3; i++) {
    const f = validateTemplate({ name: "x", category: "UTILITY", language: "en_US", body_text: text, examples: defaultExamples(text) }).find((x) => x.fix);
    if (!f) break;
    text = applyFix(text, f.fix!);
  }
  return text;
}

describe("built-in template library", () => {
  it("finds the library", () => expect(entries.length).toBeGreaterThan(50));

  it("has no Meta-blocking errors once auto-fixed", () => {
    const bad = entries.flatMap((e) => {
      const text = autofix(e.text);
      return validateTemplate({ name: e.label, category: e.category, language: "en_US", body_text: text, examples: defaultExamples(text) })
        .filter((i) => i.level === "error").map((i) => `${e.label}: ${i.message}`);
    });
    expect(bad).toEqual([]);
  });
});
