import { describe, it, expect } from "vitest";
import { continueWaitingSession, handleFlowInbound, pauseBeforeMs, type FlowRecord, type FlowSender, type FlowStore, type SessionRecord } from "../lib/flows/runtime";
import type { Action } from "../lib/flows/engine";
import { FLOW_TEMPLATES } from "../lib/flows/templates";

function memory(flows: FlowRecord[]) {
  const sessions: SessionRecord[] = [];
  const hooks: any[] = [];
  const leads: any[] = [], labels: string[] = [], humans: string[] = [], logs: string[] = [];
  const store: FlowStore = {
    async getLiveSession(u, p) { return sessions.find((s) => s.user_id === u && s.phone === p && (s.status === "active" || s.status === "waiting")) ?? null; },
    async getFlow(id) { return flows.find((f) => f.id === id) ?? null; },
    async listPublishedFlows(u) { return flows.filter((f) => f.user_id === u && f.published_definition); },
    async createSession(row) {
      if (sessions.some((s) => s.user_id === row.user_id && s.phone === row.phone && (s.status === "active" || s.status === "waiting"))) return null;
      const rec = { ...row, id: `s${sessions.length + 1}` }; sessions.push(rec); return rec;
    },
    async saveSession(id, patch) { Object.assign(sessions.find((s) => s.id === id)!, patch); },
    async insertLead(l) { leads.push(l); },
    async addLabel(_u, _p, l) { labels.push(l); },
    async markNeedsHuman(_u, _p, n) { humans.push(n); },
    async logOutbound(_u, _p, c) { logs.push(c); },
    async postWebhook(url, body) { hooks.push({ url, body }); return !url.includes("down"); },
  };
  return { store, sessions, leads, labels, humans, logs, hooks };
}

function sender(failOn?: number) {
  const sent: Action[] = []; const typed: string[] = [];
  const s: FlowSender = {
    async send(a) { if (failOn !== undefined && sent.length === failOn) { const e: any = new Error("window"); e.metaError = { code: 131047 }; throw e; } sent.push(a); return `wamid.${sent.length}`; },
    async typing(id) { typed.push(id); },
  };
  return { s, sent, typed };
}

const flowFrom = (id: string, user = "u1"): FlowRecord => {
  const t = FLOW_TEMPLATES.find((x) => x.id === id)!;
  return { id: `f-${id}`, user_id: user, name: t.name, trigger_type: t.settings.trigger_type, keywords: t.settings.keywords, exit_keywords: t.settings.exit_keywords, published_definition: t.definition };
};

const base = { userId: "u1", phone: "919876543210", contactName: "Priya", isFirstMessage: false };
const noSleep = async () => {};
let n = 0;
const msg = () => `wamid.in${++n}`;

describe("live conversations", () => {
  it("starts on a keyword, walks the customer through, and saves the lead", async () => {
    const m = memory([flowFrom("lead-capture")]); const x = sender();
    const deps = { store: m.store, sender: x.s, sleep: noSleep };

    expect(await handleFlowInbound(deps, { ...base, inbound: { kind: "text", text: "Enquiry" }, messageId: msg() })).toBe(true);
    expect(x.sent.map((a) => a.type)).toEqual(["text", "text"]);
    expect(m.sessions[0]).toMatchObject({ status: "active", current_node_id: "q1" });
    expect(x.typed.length).toBe(1); // blue ticks + typing before replying

    await handleFlowInbound(deps, { ...base, inbound: { kind: "text", text: "Priya Sharma" }, messageId: msg() });
    await handleFlowInbound(deps, { ...base, inbound: { kind: "text", text: "priya@example.com" }, messageId: msg() });
    await handleFlowInbound(deps, { ...base, inbound: { kind: "reply", id: "b_price", title: "Pricing" }, messageId: msg() });

    expect(m.leads).toHaveLength(1);
    expect(m.leads[0]).toMatchObject({ phone: "919876543210", name: "Priya Sharma", email: "priya@example.com", flow_name: "Capture a lead" });
    expect(m.leads[0].fields.interest).toBe("Pricing");
    expect(m.sessions[0].status).toBe("completed");
    expect(m.logs.length).toBe(x.sent.length); // every message appears in the inbox history
  });

  it("does nothing when no flow applies, so ordinary automations can answer", async () => {
    const m = memory([flowFrom("lead-capture")]); const x = sender();
    const handled = await handleFlowInbound({ store: m.store, sender: x.s, sleep: noSleep }, { ...base, inbound: { kind: "text", text: "what is the price?" }, messageId: msg() });
    expect(handled).toBe(false);
    expect(x.sent).toHaveLength(0);
  });

  it("starts a welcome flow only on the customer's first message", async () => {
    const m = memory([flowFrom("faq-menu")]); const x = sender();
    const deps = { store: m.store, sender: x.s, sleep: noSleep };
    expect(await handleFlowInbound(deps, { ...base, inbound: { kind: "text", text: "hello" }, messageId: msg(), isFirstMessage: false })).toBe(false);
    expect(await handleFlowInbound(deps, { ...base, inbound: { kind: "text", text: "hello" }, messageId: msg(), isFirstMessage: true })).toBe(true);
  });

  it("lets the customer leave with a cancel word", async () => {
    const m = memory([flowFrom("lead-capture")]); const x = sender();
    const deps = { store: m.store, sender: x.s, sleep: noSleep };
    await handleFlowInbound(deps, { ...base, inbound: { kind: "text", text: "enquiry" }, messageId: msg() });
    await handleFlowInbound(deps, { ...base, inbound: { kind: "text", text: "Cancel" }, messageId: msg() });
    expect(m.sessions[0]).toMatchObject({ status: "completed", ended_reason: "cancelled" });
    expect((x.sent.at(-1) as any).text).toMatch(/stopped/);
  });

  it("hands over to a person and records the note", async () => {
    const m = memory([flowFrom("faq-menu")]); const x = sender();
    const deps = { store: m.store, sender: x.s, sleep: noSleep };
    await handleFlowInbound(deps, { ...base, inbound: { kind: "text", text: "enquiry" }, messageId: msg(), isFirstMessage: true });
    await handleFlowInbound(deps, { ...base, inbound: { kind: "reply", id: "b_person", title: "Talk to a person" }, messageId: msg() });
    expect(m.humans).toEqual(["Asked for a person from the FAQ menu"]);
    expect(m.sessions[0].status).toBe("handoff");
    // the bot now stays quiet: a handed-over conversation is not "live"
    expect(await handleFlowInbound(deps, { ...base, inbound: { kind: "text", text: "hello?" }, messageId: msg() })).toBe(false);
  });

  it("adds labels from a tag block", async () => {
    const m = memory([flowFrom("appointment")]); const x = sender();
    const deps = { store: m.store, sender: x.s, sleep: noSleep };
    await handleFlowInbound(deps, { ...base, inbound: { kind: "text", text: "book" }, messageId: msg() });
    await handleFlowInbound(deps, { ...base, inbound: { kind: "reply", id: "r_a", title: "Consultation" }, messageId: msg() });
    await handleFlowInbound(deps, { ...base, inbound: { kind: "text", text: "Friday 4 PM" }, messageId: msg() });
    await handleFlowInbound(deps, { ...base, inbound: { kind: "text", text: "Priya" }, messageId: msg() });
    expect(m.labels).toEqual(["appointment"]);
    expect(m.leads[0].fields).toMatchObject({ service: "Consultation", preferred_time: "Friday 4 PM" });
  });

  it("keeps two customers' conversations separate", async () => {
    const m = memory([flowFrom("lead-capture")]); const x = sender();
    const deps = { store: m.store, sender: x.s, sleep: noSleep };
    await handleFlowInbound(deps, { ...base, phone: "911", inbound: { kind: "text", text: "enquiry" }, messageId: msg() });
    await handleFlowInbound(deps, { ...base, phone: "912", inbound: { kind: "text", text: "enquiry" }, messageId: msg() });
    await handleFlowInbound(deps, { ...base, phone: "911", inbound: { kind: "text", text: "Asha" }, messageId: msg() });
    expect(m.sessions.find((s) => s.phone === "911")!.variables.name).toBe("Asha");
    expect(m.sessions.find((s) => s.phone === "912")!.variables.name).toBeUndefined();
  });

  it("ends the conversation cleanly, without throwing, if WhatsApp refuses a message", async () => {
    const m = memory([flowFrom("lead-capture")]); const x = sender(1); // second message fails: window closed
    const handled = await handleFlowInbound({ store: m.store, sender: x.s, sleep: noSleep }, { ...base, inbound: { kind: "text", text: "enquiry" }, messageId: msg() });
    expect(handled).toBe(true);
    expect(m.sessions[0]).toMatchObject({ status: "abandoned", ended_reason: "window_closed" });
  });
});

describe("waits", () => {
  const waitFlow = (seconds: number): FlowRecord => ({
    id: "fw", user_id: "u1", name: "Follow up", trigger_type: "keyword", keywords: ["follow"], exit_keywords: ["cancel"],
    published_definition: {
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
        { id: "m1", type: "message", position: { x: 0, y: 0 }, data: { text: "Thanks!" } },
        { id: "w", type: "wait", position: { x: 0, y: 0 }, data: { seconds } },
        { id: "m2", type: "message", position: { x: 0, y: 0 }, data: { text: "Just checking in 🙂" } },
      ],
      edges: [
        { id: "1", source: "start", sourceHandle: "next", target: "m1" },
        { id: "2", source: "m1", sourceHandle: "next", target: "w" },
        { id: "3", source: "w", sourceHandle: "next", target: "m2" },
      ],
    },
  });

  it("schedules a long wait, then the timer continues the conversation", async () => {
    const m = memory([waitFlow(7200)]); const x = sender();
    const now = new Date("2026-10-28T10:00:00Z");
    const deps = { store: m.store, sender: x.s, sleep: noSleep, now: () => now };
    await handleFlowInbound(deps, { ...base, inbound: { kind: "text", text: "follow" }, messageId: msg() });
    expect(x.sent.map((a) => (a as any).text)).toEqual(["Thanks!"]);
    expect(m.sessions[0]).toMatchObject({ status: "waiting", waiting_until: "2026-10-28T12:00:00.000Z" });

    // customer chats during the wait: the flow does not interrupt itself
    expect(await handleFlowInbound(deps, { ...base, inbound: { kind: "text", text: "anyone?" }, messageId: msg() })).toBe(false);

    await continueWaitingSession(deps, { ...m.sessions[0], status: "active" });
    expect(x.sent.map((a) => (a as any).text)).toEqual(["Thanks!", "Just checking in 🙂"]);
    expect(m.sessions[0].status).toBe("completed");
  });

  it("does short waits immediately instead of scheduling them", async () => {
    const m = memory([waitFlow(2)]); const x = sender(); const slept: number[] = [];
    await handleFlowInbound({ store: m.store, sender: x.s, sleep: async (ms) => { slept.push(ms); } }, { ...base, inbound: { kind: "text", text: "follow" }, messageId: msg() });
    expect(x.sent).toHaveLength(2);
    expect(slept).toContain(2000);
    expect(m.sessions[0].status).toBe("completed");
  });
});

describe("pacing", () => {
  it("pauses longer after longer messages, never more than 4 seconds, and not before the first", () => {
    expect(pauseBeforeMs(null)).toBe(0);
    expect(pauseBeforeMs({ type: "text", text: "Hi" })).toBeLessThan(pauseBeforeMs({ type: "text", text: "x".repeat(300) }));
    expect(pauseBeforeMs({ type: "text", text: "x".repeat(5000) })).toBe(4000);
  });
});

describe("send to a URL block", () => {
  const flowWith = (url: string): FlowRecord => {
    const f = flowFrom("lead-capture");
    const def = structuredClone(f.published_definition!);
    def.nodes.push({ id: "hook", type: "webhook", position: { x: 0, y: 0 }, data: { url } } as any);
    const e = def.edges.find((x) => x.source === "lead" && x.sourceHandle === "next")!;
    def.edges.push({ id: "lead-hook", source: "lead", sourceHandle: "next", target: "hook" }, { id: "hook-next", source: "hook", sourceHandle: "next", target: e.target });
    def.edges = def.edges.filter((x) => x !== e);
    return { ...f, published_definition: def };
  };
  const walk = async (m: ReturnType<typeof memory>, x: ReturnType<typeof sender>) => {
    const deps = { store: m.store, sender: x.s, sleep: noSleep };
    await handleFlowInbound(deps, { ...base, inbound: { kind: "text", text: "Enquiry" }, messageId: msg() });
    await handleFlowInbound(deps, { ...base, inbound: { kind: "text", text: "Priya" }, messageId: msg() });
    await handleFlowInbound(deps, { ...base, inbound: { kind: "text", text: "priya@example.com" }, messageId: msg() });
    await handleFlowInbound(deps, { ...base, inbound: { kind: "reply", id: "b_price", title: "Pricing" }, messageId: msg() });
  };

  it("sends the answers to the business's URL and the conversation carries on", async () => {
    const m = memory([flowWith("https://hooks.example.com/abc")]); const x = sender();
    await walk(m, x);
    expect(m.hooks).toHaveLength(1);
    expect(m.hooks[0].url).toBe("https://hooks.example.com/abc");
    expect(m.hooks[0].body).toMatchObject({ event: "flow.details", phone: base.phone, details: { name: "Priya", email: "priya@example.com" } });
    expect(m.sessions[0].status).toBe("completed");
  });

  it("keeps going when the other system is down", async () => {
    const m = memory([flowWith("https://down.example.com/x")]); const x = sender();
    await walk(m, x);
    expect(m.sessions[0].status).toBe("completed");
  });
});
