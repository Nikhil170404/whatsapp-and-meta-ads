import { describe, it, expect } from "vitest";
import {
  validateTemplate, applyFix, buildMetaComponents, buildAuthComponents, buildOtpSendComponents,
  resolveBodyParameters, validateVariablePlan, defaultVariablePlan, toMetaName, isValidOtpCode, defaultExamples,
} from "../lib/whatsapp/template-builder";

const base = { name: "order_update", category: "UTILITY" as const, language: "en_US", body_text: "Hi {{1}}, your order {{2}} has shipped today.", examples: ["Rahul", "123"] };
const msgs = (t: any) => validateTemplate(t).map((i) => i.message).join(" | ");

describe("validateTemplate", () => {
  it("accepts a good template", () => {
    expect(validateTemplate(base).filter((i) => i.level === "error")).toEqual([]);
  });
  it("blocks a variable at the start and offers a fix", () => {
    const issues = validateTemplate({ ...base, body_text: "{{1}} your order {{2}} shipped today" });
    const issue = issues.find((i) => i.fix === "wrap_start");
    expect(issue).toBeTruthy();
    const fixed = applyFix("{{1}} your order {{2}} shipped today", "wrap_start");
    expect(validateTemplate({ ...base, body_text: fixed }).some((i) => i.fix === "wrap_start")).toBe(false);
  });
  it("blocks a variable at the end and offers a fix", () => {
    expect(validateTemplate({ ...base, body_text: "Your order id is {{1}}", examples: ["1"] }).some((i) => i.fix === "wrap_end")).toBe(true);
    const fixed = applyFix("Your order id is {{1}}", "wrap_end");
    expect(validateTemplate({ ...base, body_text: fixed, examples: ["1"] }).some((i) => i.fix === "wrap_end")).toBe(false);
  });
  it("allows a variable followed by punctuation only when text follows", () => {
    expect(msgs({ ...base, body_text: "Hello {{1}}, thanks for shopping with us at our store.", examples: ["A"] })).not.toMatch(/end with/);
  });
  it("requires sequential variables and offers renumbering", () => {
    const t = { ...base, body_text: "Hi {{2}}, order {{5}} is on its way to you today." };
    expect(validateTemplate(t).some((i) => i.fix === "renumber")).toBe(true);
    expect(applyFix(t.body_text, "renumber")).toBe("Hi {{1}}, order {{2}} is on its way to you today.");
  });
  it("requires example values", () => {
    expect(msgs({ ...base, examples: ["Rahul", ""] })).toMatch(/sample value/);
  });
  it("blocks adjacent variables", () => {
    expect(msgs({ ...base, body_text: "Hi {{1}}{{2}} your order shipped today ok" })).toMatch(/next to each other/);
  });
  it("enforces length limits", () => {
    expect(msgs({ ...base, body_text: "a ".repeat(600) })).toMatch(/limit is 1024/);
    expect(msgs({ ...base, header_text: "h".repeat(61) })).toMatch(/header/);
  });
  it("checks buttons", () => {
    expect(msgs({ ...base, buttons: [{ type: "URL", text: "Open", url: "http://x" }] })).toMatch(/https/);
    expect(msgs({ ...base, buttons: [{ type: "PHONE_NUMBER", text: "Call", phone_number: "98765" }] })).toMatch(/country code/);
    expect(msgs({ ...base, buttons: Array.from({ length: 4 }, (_, i) => ({ type: "QUICK_REPLY" as const, text: `b${i}` })) })).toMatch(/quick-reply/);
    expect(msgs({ ...base, buttons: [{ type: "QUICK_REPLY", text: "Yes" }, { type: "QUICK_REPLY", text: "yes" }] })).toMatch(/both called/);
  });
  it("warns marketing templates without an opt-out line", () => {
    const issues = validateTemplate({ ...base, category: "MARKETING", body_text: "Big sale on all items this weekend for you", examples: [] });
    expect(issues.some((i) => i.level === "warning" && i.field === "footer")).toBe(true);
    expect(validateTemplate({ ...base, category: "MARKETING", body_text: "Big sale on all items this weekend for you", footer_text: "Reply STOP to unsubscribe", examples: [] })
      .some((i) => i.field === "footer")).toBe(false);
  });
});

describe("buildMetaComponents", () => {
  it("includes example values for variables (Meta rejects templates without them)", () => {
    const body: any = buildMetaComponents(base).find((c) => c.type === "BODY");
    expect(body.example).toEqual({ body_text: [["Rahul", "123"]] });
  });
  it("omits examples when there are no variables", () => {
    const body: any = buildMetaComponents({ ...base, body_text: "Thanks for contacting us today", examples: [] }).find((c) => c.type === "BODY");
    expect(body.example).toBeUndefined();
  });
  it("adds header, footer and buttons", () => {
    const c = buildMetaComponents({ ...base, header_text: "Order", footer_text: "Reply STOP", buttons: [{ type: "QUICK_REPLY", text: "Track" }] });
    expect(c.map((x) => x.type)).toEqual(["HEADER", "BODY", "FOOTER", "BUTTONS"]);
  });
});

describe("authentication templates", () => {
  it("uses Meta's fixed format and clamps the expiry", () => {
    const c: any = buildAuthComponents({ expiry_minutes: 500 });
    expect(c[0]).toEqual({ type: "BODY", add_security_recommendation: true });
    expect(c[1].code_expiration_minutes).toBe(90);
    expect(c[2].buttons[0]).toEqual({ type: "OTP", otp_type: "COPY_CODE" });
  });
  it("builds send components with the code in body and button", () => {
    const c: any = buildOtpSendComponents("123456");
    expect(c[0].parameters[0].text).toBe("123456");
    expect(c[1]).toMatchObject({ type: "button", sub_type: "url", index: "0" });
  });
  it("validates codes", () => {
    expect(isValidOtpCode("123456")).toBe(true);
    expect(isValidOtpCode("12")).toBe(false);
    expect(isValidOtpCode("12 34")).toBe(false);
    expect(isValidOtpCode(123456)).toBe(false);
  });
});

describe("variable plans", () => {
  const body = "Hi {{1}}, flat {{2}} off until {{3}} for all items.";
  it("defaults variable 1 to the contact name", () => {
    expect(defaultVariablePlan(body)[0]).toEqual({ source: "name" });
  });
  it("blocks sending until every fixed value is filled in", () => {
    expect(validateVariablePlan(body, defaultVariablePlan(body))).toMatch(/\{\{2\}\}/);
    expect(validateVariablePlan(body, [{ source: "name" }, { source: "text", value: "20%" }, { source: "text", value: "Sunday" }])).toBeNull();
  });
  it("never sends an empty parameter", () => {
    expect(resolveBodyParameters(body, [{ source: "name" }, { source: "text", value: "20%" }, { source: "text", value: "" }], { name: null, phone: "+91" })).toEqual(["there", "20%", "-"]);
  });
  it("uses the phone number and strips newlines", () => {
    expect(resolveBodyParameters("a {{1}} b {{2}} c d e f", [{ source: "phone" }, { source: "text", value: "x\ny" }], { name: "A", phone: "+9199" })).toEqual(["+9199", "x y"]);
  });
});

describe("helpers", () => {
  it("makes Meta-safe names", () => expect(toMetaName(" Order Update! ")).toBe("order_update"));
  it("suggests one example per variable", () => expect(defaultExamples("Hi {{1}} and {{2}}")).toHaveLength(2));
});
