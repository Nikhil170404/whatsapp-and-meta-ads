import { describe, it, expect } from "vitest";
import { extractInboundText, pickAutomation, validateListOptions, slugifyId } from "../lib/whatsapp/flow";

const rule = (id: string, trigger_type: string, kw?: string) => ({ id, trigger_type, trigger_keyword: kw ?? null });

describe("extractInboundText", () => {
  it("reads typed text", () => {
    expect(extractInboundText({ type: "text", text: { body: "Hi" } })).toEqual({ text: "Hi", isTap: false });
  });
  it("reads a reply-button tap", () => {
    const m = { type: "interactive", interactive: { type: "button_reply", button_reply: { id: "b1", title: "Pricing" } } };
    expect(extractInboundText(m)).toEqual({ text: "Pricing", replyId: "b1", isTap: true });
  });
  it("reads a list tap", () => {
    const m = { type: "interactive", interactive: { type: "list_reply", list_reply: { id: "r1", title: "Hours" } } };
    expect(extractInboundText(m)?.text).toBe("Hours");
  });
  it("reads a template quick-reply tap", () => {
    expect(extractInboundText({ type: "button", button: { text: "Yes" } })?.text).toBe("Yes");
  });
  it("ignores media", () => {
    expect(extractInboundText({ type: "image" })).toBeNull();
  });
});

describe("pickAutomation", () => {
  const any = rule("any", "any");
  const welcome = rule("welcome", "welcome");
  const price = rule("price", "keyword", "price");
  const priceList = rule("pl", "keyword", "price list");

  it("prefers a keyword over an earlier 'any' rule", () => {
    expect(pickAutomation([any, price], { text: "what is the price?" }, false)?.id).toBe("price");
  });
  it("prefers the more specific keyword", () => {
    expect(pickAutomation([price, priceList], { text: "send price list please" }, false)?.id).toBe("pl");
  });
  it("prefers an exact match", () => {
    expect(pickAutomation([priceList, price], { text: "Price" }, false)?.id).toBe("price");
  });
  it("matches a tapped option by id", () => {
    expect(pickAutomation([price], { text: "See prices", replyId: "price" }, false)?.id).toBe("price");
  });
  it("uses welcome only on the first message", () => {
    expect(pickAutomation([welcome, any], { text: "hello" }, true)?.id).toBe("welcome");
    expect(pickAutomation([welcome, any], { text: "hello" }, false)?.id).toBe("any");
  });
  it("returns nothing when nothing applies", () => {
    expect(pickAutomation([price], { text: "hello" }, false)).toBeUndefined();
  });
});

describe("validateListOptions", () => {
  const ok = { list_button: "View", rows: [{ id: "a", title: "A" }] };
  it("accepts a valid menu", () => expect(validateListOptions(ok, "Pick one")).toBeNull());
  it("requires body text", () => expect(validateListOptions(ok, "")).toMatch(/message text/i));
  it("caps rows at 10", () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({ id: `r${i}`, title: `R${i}` }));
    expect(validateListOptions({ ...ok, rows }, "x")).toMatch(/at most 10/);
  });
  it("caps title length at 24", () => {
    expect(validateListOptions({ ...ok, rows: [{ id: "a", title: "x".repeat(25) }] }, "x")).toMatch(/24/);
  });
  it("rejects duplicate ids", () => {
    expect(validateListOptions({ ...ok, rows: [{ id: "a", title: "A" }, { id: "a", title: "B" }] }, "x")).toMatch(/same id/);
  });
});

describe("slugifyId", () => {
  it("makes safe ids", () => expect(slugifyId("Opening Hours!", "r1")).toBe("opening_hours"));
  it("falls back", () => expect(slugifyId("!!!", "r1")).toBe("r1"));
});

import { analyzeFlows } from "../lib/whatsapp/flow";

describe("analyzeFlows", () => {
  const menu = { id: "m", name: "Main menu", is_active: true, trigger_type: "welcome", message_type: "list",
    button_options: { rows: [{ title: "Pricing" }, { title: "Hours" }] } };
  const kw = (id: string, k: string, active = true) => ({ id, name: k, is_active: active, trigger_type: "keyword", trigger_keyword: k, message_type: "text" });

  it("flags menu options that have no reply behind them", () => {
    const issues = analyzeFlows([menu, kw("a", "pricing")]);
    expect(issues).toHaveLength(1);
    expect(issues[0].createKeyword).toBe("Hours");
    expect(issues[0].level).toBe("error");
  });
  it("is quiet when every option is answered", () => {
    expect(analyzeFlows([menu, kw("a", "pricing"), kw("b", "hours")]).filter((i) => i.level === "error")).toEqual([]);
  });
  it("ignores inactive automations when checking answers", () => {
    expect(analyzeFlows([menu, kw("a", "pricing"), kw("b", "hours", false)]).some((i) => i.createKeyword === "Hours")).toBe(true);
  });
  it("warns about duplicate keywords and several any/welcome rules", () => {
    const text = analyzeFlows([kw("a", "price"), kw("b", "price")]).map((i) => i.message).join(" ");
    expect(text).toMatch(/2 automations use the keyword/);
    const any2 = analyzeFlows([
      { id: "x", name: "A", is_active: true, trigger_type: "any" },
      { id: "y", name: "B", is_active: true, trigger_type: "any" },
    ]).map((i) => i.message).join(" ");
    expect(any2).toMatch(/2 “any message”/);
  });
  it("warns about very short keywords", () => {
    expect(analyzeFlows([kw("a", "hi")]).some((i) => /very short/.test(i.message))).toBe(true);
  });
});

import { describeInbound } from "../lib/whatsapp/flow";
import { addressTo, isBsuid } from "../lib/whatsapp/service";

describe("describeInbound", () => {
  it("describes media with captions", () => {
    expect(describeInbound({ type: "image", image: { caption: "my order" } })).toBe("📷 Photo: my order");
    expect(describeInbound({ type: "image", image: {} })).toBe("📷 Photo");
    expect(describeInbound({ type: "audio", audio: { voice: true } })).toBe("🎤 Voice message");
    expect(describeInbound({ type: "document", document: { filename: "bill.pdf" } })).toBe("📄 Document: bill.pdf");
  });
  it("describes locations and taps", () => {
    expect(describeInbound({ type: "location", location: { name: "Shop", address: "Pune" } })).toBe("📍 Location: Shop, Pune");
    expect(describeInbound({ type: "interactive", interactive: { list_reply: { id: "a", title: "Pricing" } } })).toBe("Pricing");
  });
  it("never shows a raw placeholder for known types", () => {
    expect(describeInbound({ type: "text", text: { body: "hi" } })).toBe("hi");
  });
});

describe("recipient addressing", () => {
  it("uses `to` for phone numbers", () => {
    expect(addressTo("919876543210")).toEqual({ to: "919876543210" });
    expect(addressTo("+919876543210")).toEqual({ to: "+919876543210" });
  });
  it("uses `recipient` for business-scoped user ids", () => {
    expect(isBsuid("IN.13491208655302741918")).toBe(true);
    expect(addressTo("US.13491208655302741918")).toEqual({ recipient: "US.13491208655302741918" });
    expect(isBsuid("US.ENT.11815799212886844830")).toBe(true);
  });
  it("does not mistake other text for a user id", () => {
    expect(isBsuid("hello.world")).toBe(false);
    expect(isBsuid("919876543210")).toBe(false);
  });
});
