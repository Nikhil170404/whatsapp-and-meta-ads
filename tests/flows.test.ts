import { describe, it, expect } from "vitest";
import { startFlow, resumeFlow, continueAfterWait, render, MAX_STEPS, type Action, type Session } from "../lib/flows/engine";
import { validateFlow, sanitize, hasErrors } from "../lib/flows/validate";
import { validateInput } from "../lib/flows/inputs";
import { FLOW_TEMPLATES, blankFlow } from "../lib/flows/templates";
import type { FlowDefinition } from "../lib/flows/types";

const ctx = { contactName: "Priya", phone: "919876543210" };
const types = (a: Action[]) => a.map((x) => x.type);
const tpl = (id: string) => FLOW_TEMPLATES.find((t) => t.id === id)!;

describe("lead capture, end to end", () => {
  const flow = tpl("lead-capture").definition;

  it("asks one thing at a time and stores each answer", () => {
    let r = startFlow(flow, ctx);
    expect(types(r.actions)).toEqual(["text", "text"]);
    expect((r.actions[0] as any).text).toContain("Hi Priya");
    expect(r.session.currentNodeId).toBe("q1");

    r = resumeFlow(flow, r.session, { kind: "text", text: "Priya Sharma" }, ctx);
    expect(r.session.variables.name).toBe("Priya Sharma");
    expect((r.actions[0] as any).text).toContain("Thanks Priya Sharma");

    r = resumeFlow(flow, r.session, { kind: "text", text: "Priya@Example.com" }, ctx);
    expect(r.session.variables.email).toBe("priya@example.com");
    expect(types(r.actions)).toEqual(["buttons"]);

    r = resumeFlow(flow, r.session, { kind: "reply", id: "b_demo", title: "Book a demo" }, ctx);
    expect(types(r.actions)).toEqual(["lead", "text"]);
    const lead = r.actions[0] as any;
    expect(lead.fields).toMatchObject({ name: "Priya Sharma", email: "priya@example.com", interest: "Book a demo" });
    expect((r.actions[1] as any).text).toContain("“Book a demo”");
    expect(r.session.status).toBe("completed");
  });

  it("asks again on invalid input, then gives up politely instead of looping forever", () => {
    let r = startFlow(flow, ctx);
    r = resumeFlow(flow, r.session, { kind: "text", text: "Priya" }, ctx); // name ok, now email
    r = resumeFlow(flow, r.session, { kind: "text", text: "not an email" }, ctx);
    expect((r.actions[0] as any).text).toMatch(/email address/);
    expect(r.session.currentNodeId).toBe("q2");
    r = resumeFlow(flow, r.session, { kind: "text", text: "still no" }, ctx);
    r = resumeFlow(flow, r.session, { kind: "text", text: "nope" }, ctx); // 3rd miss, past maxRetries 2
    expect(r.session.status).toBe("completed");
    expect(r.session.endedReason).toBe("gave_up");
  });

  it("lets a skippable question be skipped", () => {
    let r = startFlow(flow, ctx);
    r = resumeFlow(flow, r.session, { kind: "text", text: "Priya" }, ctx);
    r = resumeFlow(flow, r.session, { kind: "text", text: "skip" }, ctx);
    expect(r.session.variables.email).toBe("");
    expect(types(r.actions)).toEqual(["buttons"]);
  });

  it("re-shows buttons if the customer types something else", () => {
    let r = startFlow(flow, ctx);
    r = resumeFlow(flow, r.session, { kind: "text", text: "Priya" }, ctx);
    r = resumeFlow(flow, r.session, { kind: "text", text: "a@b.co" }, ctx);
    r = resumeFlow(flow, r.session, { kind: "text", text: "hmm" }, ctx);
    expect(types(r.actions)).toEqual(["text", "buttons"]);
  });

  it("accepts a typed button label as a tap", () => {
    let r = startFlow(flow, ctx);
    r = resumeFlow(flow, r.session, { kind: "text", text: "Priya" }, ctx);
    r = resumeFlow(flow, r.session, { kind: "text", text: "a@b.co" }, ctx);
    r = resumeFlow(flow, r.session, { kind: "text", text: "pricing" }, ctx);
    expect(r.session.variables.interest).toBe("Pricing");
  });
});

describe("menus, conditions, waits, handoff", () => {
  it("routes by menu choice and hands over to a person", () => {
    const flow = tpl("faq-menu").definition;
    let r = startFlow(flow, ctx);
    expect(types(r.actions)).toEqual(["buttons"]);
    r = resumeFlow(flow, r.session, { kind: "reply", id: "b_person", title: "Talk to a person" }, ctx);
    expect(types(r.actions)).toEqual(["text", "handoff"]);
    expect(r.session.status).toBe("handoff");
  });

  it("branches on a condition", () => {
    const flow: FlowDefinition = {
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
        { id: "c", type: "condition", position: { x: 0, y: 0 }, data: { variable: "rating", op: "equals", value: "great" } },
        { id: "y", type: "end", position: { x: 0, y: 0 }, data: { text: "yes path" } },
        { id: "n", type: "end", position: { x: 0, y: 0 }, data: { text: "no path" } },
      ],
      edges: [
        { id: "1", source: "start", sourceHandle: "next", target: "c" },
        { id: "2", source: "c", sourceHandle: "yes", target: "y" },
        { id: "3", source: "c", sourceHandle: "no", target: "n" },
      ],
    };
    expect((startFlow(flow, ctx).actions[0] as any).text).toBe("no path"); // rating not collected
  });

  it("pauses at a wait block and continues afterwards", () => {
    const flow: FlowDefinition = {
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
        { id: "m1", type: "message", position: { x: 0, y: 0 }, data: { text: "First" } },
        { id: "w", type: "wait", position: { x: 0, y: 0 }, data: { seconds: 3600 } },
        { id: "m2", type: "message", position: { x: 0, y: 0 }, data: { text: "An hour later" } },
      ],
      edges: [
        { id: "1", source: "start", sourceHandle: "next", target: "m1" },
        { id: "2", source: "m1", sourceHandle: "next", target: "w" },
        { id: "3", source: "w", sourceHandle: "next", target: "m2" },
      ],
    };
    const r = startFlow(flow, ctx);
    expect(types(r.actions)).toEqual(["text", "delay"]);
    expect(r.session).toMatchObject({ status: "waiting", waitSeconds: 3600, currentNodeId: "m2" });
    const after = continueAfterWait(flow, r.session, ctx);
    expect((after.actions[0] as any).text).toBe("An hour later");
    expect(after.session.status).toBe("completed");
  });

  it("stops an instant loop instead of hanging", () => {
    const flow: FlowDefinition = {
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
        { id: "a", type: "message", position: { x: 0, y: 0 }, data: { text: "again" } },
      ],
      edges: [
        { id: "1", source: "start", sourceHandle: "next", target: "a" },
        { id: "2", source: "a", sourceHandle: "next", target: "a" },
      ],
    };
    const r = startFlow(flow, ctx);
    expect(r.session.endedReason).toBe("loop");
    expect(r.actions.length).toBeLessThanOrEqual(MAX_STEPS + 1);
  });

  it("collects a shared location", () => {
    const flow: FlowDefinition = {
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
        { id: "l", type: "location", position: { x: 0, y: 0 }, data: { text: "Where are you?", variable: "where" } },
        { id: "e", type: "end", position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [{ id: "1", source: "start", sourceHandle: "next", target: "l" }, { id: "2", source: "l", sourceHandle: "next", target: "e" }],
    };
    let r = startFlow(flow, ctx);
    expect(types(r.actions)).toEqual(["location_request"]);
    r = resumeFlow(flow, r.session, { kind: "location", latitude: 18.5, longitude: 73.8, name: "Shop" }, ctx);
    expect(r.session.variables).toMatchObject({ where: "18.5,73.8", where_name: "Shop" });
  });
});

describe("render", () => {
  it("fills variables, falls back for the contact name, and never shows braces", () => {
    expect(render("Hi {{contact_name}}, {{x}}!", { x: "ok" }, { phone: "9199" })).toBe("Hi there, ok!");
    expect(render("{{missing}}|", {}, ctx)).toBe("|");
    expect(render("{{phone}}", {}, ctx)).toBe("+919876543210");
  });
});

describe("input validation", () => {
  it("email", () => { expect(validateInput("email", " A@B.com ")).toEqual({ ok: true, value: "a@b.com" }); expect(validateInput("email", "a@b").ok).toBe(false); });
  it("phone, assuming India for a bare 10-digit mobile", () => {
    expect(validateInput("phone", "98765 43210")).toEqual({ ok: true, value: "+919876543210" });
    expect(validateInput("phone", "+44 7700 900123").value).toBe("+447700900123");
    expect(validateInput("phone", "123").ok).toBe(false);
  });
  it("number, name, text", () => {
    expect(validateInput("number", "1,200.50")).toEqual({ ok: true, value: "1200.50" });
    expect(validateInput("number", "abc").ok).toBe(false);
    expect(validateInput("name", "Anaïs O'Neil").ok).toBe(true);
    expect(validateInput("name", "12345").ok).toBe(false);
    expect(validateInput("text", "   ").ok).toBe(false);
  });
});

describe("validation (what the editor shows)", () => {
  const msgs = (f: FlowDefinition, s?: any) => validateFlow(f, s).map((i) => `${i.level}: ${i.message}`).join(" | ");

  it("every starter template is valid", () => {
    for (const t of FLOW_TEMPLATES) {
      // The payment template ships without a link on purpose: it must be filled in before publishing.
      const errors = validateFlow(t.definition, t.settings).filter((i) => i.level === "error" && !/payment link/i.test(i.message));
      expect(errors, t.id).toEqual([]);
    }
  });

  it("a blank flow explains what to do next", () => {
    const b = blankFlow();
    expect(msgs(b.definition, b.settings)).toMatch(/Connect the Start block/);
    expect(msgs(b.definition, b.settings)).toMatch(/keyword/);
  });

  it("flags a button that goes nowhere, naming it", () => {
    const f = structuredClone(tpl("faq-menu").definition);
    f.edges = f.edges.filter((e) => e.sourceHandle !== "btn:b_price");
    expect(msgs(f)).toMatch(/“Prices” goes nowhere/);
    expect(hasErrors(validateFlow(f))).toBe(true);
  });

  it("enforces Meta's interactive limits", () => {
    const f = structuredClone(tpl("faq-menu").definition);
    const menu = f.nodes.find((x) => x.id === "menu")!.data as any;
    menu.buttons.push({ id: "b4", title: "A very long button label indeed" });
    const m = msgs(f);
    expect(m).toMatch(/at most 3 buttons/);
    expect(m).toMatch(/limited to 20 characters/);
  });

  it("flags unreachable blocks, duplicate answer names and unknown variables", () => {
    const f = structuredClone(tpl("lead-capture").definition);
    (f.nodes.find((x) => x.id === "q2")!.data as any).variable = "name";
    f.nodes.push({ id: "orphan", type: "message", position: { x: 0, y: 0 }, data: { text: "Hello {{nope}}" } });
    const m = msgs(f);
    expect(m).toMatch(/Two questions save their answer as “name”/);
    expect(m).toMatch(/not connected to the Start/);
    expect(m).toMatch(/“\{\{nope\}\}” is not collected/);
  });

  it("catches an instant loop and waits that exceed the 24-hour window", () => {
    const loop: FlowDefinition = {
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
        { id: "a", type: "message", position: { x: 0, y: 0 }, data: { text: "a" } },
        { id: "b", type: "message", position: { x: 0, y: 0 }, data: { text: "b" } },
      ],
      edges: [
        { id: "1", source: "start", sourceHandle: "next", target: "a" },
        { id: "2", source: "a", sourceHandle: "next", target: "b" },
        { id: "3", source: "b", sourceHandle: "next", target: "a" },
      ],
    };
    expect(msgs(loop)).toMatch(/loop back to each other/);

    const waits: FlowDefinition = {
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
        { id: "w1", type: "wait", position: { x: 0, y: 0 }, data: { seconds: 20 * 3600 } },
        { id: "w2", type: "wait", position: { x: 0, y: 0 }, data: { seconds: 20 * 3600 } },
        { id: "m", type: "message", position: { x: 0, y: 0 }, data: { text: "late" } },
      ],
      edges: [
        { id: "1", source: "start", sourceHandle: "next", target: "w1" },
        { id: "2", source: "w1", sourceHandle: "next", target: "w2" },
        { id: "3", source: "w2", sourceHandle: "next", target: "m" },
      ],
    };
    expect(msgs(waits)).toMatch(/add up to more than 23 hours/);
    const one = structuredClone(waits); (one.nodes[1].data as any).seconds = 30 * 3600;
    expect(msgs(one)).toMatch(/limited to 23 hours/);
  });

  it("reminds you to save the details you collect", () => {
    const f = structuredClone(tpl("lead-capture").definition);
    f.nodes = f.nodes.filter((x) => x.id !== "lead");
    f.edges = f.edges.filter((e) => e.source !== "lead" && e.target !== "lead");
    expect(msgs(f)).toMatch(/never save them as a lead/);
  });

  it("warns when a keyword clashes with another automation", () => {
    const t = tpl("lead-capture");
    expect(validateFlow(t.definition, t.settings, { otherKeywords: ["enquiry"] }).some((i) => /also starts another/.test(i.message))).toBe(true);
  });
});

describe("sanitize", () => {
  it("removes connections to deleted blocks and buttons, and duplicate outputs", () => {
    const f = structuredClone(tpl("faq-menu").definition);
    f.edges.push({ id: "dead", source: "menu", sourceHandle: "btn:gone", target: "end" });
    f.edges.push({ id: "ghost", source: "menu", sourceHandle: "btn:b_hours", target: "nowhere" });
    f.edges.push({ id: "dup", source: "menu", sourceHandle: "btn:b_hours", target: "end" });
    const clean = sanitize(f);
    expect(clean.edges.some((e) => e.id === "dead" || e.id === "ghost" || e.id === "dup")).toBe(false);
    expect(clean.edges.length).toBe(tpl("faq-menu").definition.edges.length);
  });
});

import { leadsToCsv } from "../lib/flows/csv";
import { parseDefinition, parseSettings } from "../lib/flows/ops";

describe("leads CSV", () => {
  it("includes every collected field and neutralises spreadsheet formulas", () => {
    const csv = leadsToCsv([
      { created_at: "2026-10-28T10:00:00Z", flow_name: "Lead", phone: "919876543210", name: "=HYPERLINK(\"http://evil\")", email: "a@b.co", fields: { service: "Consultation", city: "Pune, MH" }, note: "n" },
    ]);
    const [header, row] = csv.trim().split("\r\n");
    expect(header).toBe("Date,Flow,Phone,Name,Email,city,service,Note");
    expect(row).toContain("'=HYPERLINK");
    expect(row).toContain('"Pune, MH"');
    expect(row).toContain("+919876543210");
  });
});

describe("saving flows safely", () => {
  it("accepts a well-formed flow and rejects malformed or oversized ones", () => {
    expect(parseDefinition(FLOW_TEMPLATES[0].definition)).toBeTruthy();
    expect(parseDefinition(null)).toBeNull();
    expect(parseDefinition({ nodes: [{ id: "a", type: "script", data: {} }], edges: [] })).toBeNull();
    expect(parseDefinition({ nodes: [{ id: "a", type: "start", data: {} }, { id: "a", type: "end", data: {} }], edges: [] })).toBeNull();
    expect(parseDefinition({ nodes: Array.from({ length: 151 }, (_, i) => ({ id: `n${i}`, type: "end", data: {} })), edges: [] })).toBeNull();
  });
  it("drops connections to things that are gone", () => {
    const def = structuredClone(FLOW_TEMPLATES[1].definition);
    def.edges.push({ id: "x", source: "menu", sourceHandle: "btn:nope", target: "end" });
    expect(parseDefinition(def)!.edges.some((e) => e.id === "x")).toBe(false);
  });
  it("tidies trigger settings", () => {
    expect(parseSettings({ trigger_type: "evil", keywords: [" Hi ", "hi", "", "Book"] }, { trigger_type: "welcome" })).toMatchObject({ trigger_type: "welcome", keywords: ["hi", "book"] });
  });
});

import { autoLayout } from "../lib/flows/layout";
import { humanWait } from "../components/flows/nodeMeta";

describe("tidy layout", () => {
  it("puts each block below the one that leads to it and spreads siblings apart", () => {
    const t = autoLayout(FLOW_TEMPLATES.find((x) => x.id === "faq-menu")!.definition);
    const pos = (id: string) => t.nodes.find((n) => n.id === id)!.position;
    expect(pos("start").y).toBeLessThan(pos("menu").y);
    expect(pos("menu").y).toBeLessThan(pos("hours").y);
    expect(pos("hours").y).toBeLessThan(pos("end").y);
    const row = ["hours", "price", "person"].map((id) => pos(id).x);
    expect(new Set(row).size).toBe(3); // no two siblings on top of each other
  });
  it("keeps disconnected blocks out of the way", () => {
    const def = structuredClone(FLOW_TEMPLATES[1].definition);
    def.nodes.push({ id: "lost", type: "message", position: { x: 0, y: 0 }, data: { text: "x" } });
    const t = autoLayout(def);
    expect(t.nodes.find((n) => n.id === "lost")!.position.y).toBeGreaterThan(t.nodes.find((n) => n.id === "end")!.position.y);
  });
  it("survives a loop", () => {
    const def = structuredClone(FLOW_TEMPLATES[0].definition);
    def.edges.push({ id: "loop", source: "m2", sourceHandle: "next", target: "q1" });
    expect(() => autoLayout(def)).not.toThrow();
  });
});

describe("wait wording", () => {
  it("reads naturally", () => {
    expect(humanWait(1)).toBe("1 second");
    expect(humanWait(90)).toBe("2 minutes");
    expect(humanWait(7200)).toBe("2 hours");
    expect(humanWait(5400)).toBe("1.5 hours");
  });
});

describe("payment link block", () => {
  const withUrl = (url: string) => {
    const d = structuredClone(tpl("order-and-pay").definition);
    (d.nodes.find((n) => n.id === "pay")!.data as any).url = url;
    return d;
  };

  it("is refused until a real https payment link is pasted", () => {
    const msg = (u: string) => validateFlow(withUrl(u), tpl("order-and-pay").settings).filter((i) => i.level === "error" && /payment link/i.test(i.message)).length;
    expect(msg("")).toBe(1);
    expect(msg("http://insecure.example/pay")).toBe(1);
    expect(msg("not a link")).toBe(1);
    expect(msg("https://rzp.io/l/abc123")).toBe(0);
  });

  it("sends the message with its button, using what the customer answered", () => {
    const flow = withUrl("https://rzp.io/l/abc123");
    let r = startFlow(flow, ctx);
    r = resumeFlow(flow, r.session, { kind: "reply", id: "r_a", title: "Item A" }, ctx);
    r = resumeFlow(flow, r.session, { kind: "text", text: "Priya Sharma" }, ctx);
    r = resumeFlow(flow, r.session, { kind: "text", text: "12 MG Road, Pune 411001" }, ctx);
    const pay = r.actions.find((a) => a.type === "cta_url") as any;
    expect(pay).toMatchObject({ type: "cta_url", label: "Pay now", url: "https://rzp.io/l/abc123" });
    expect(pay.text).toContain("Priya Sharma");
    expect(pay.text).toContain("Item A");
    expect(r.actions.some((a) => a.type === "lead")).toBe(true);
    expect(r.session.status).toBe("handoff");
  });
});
