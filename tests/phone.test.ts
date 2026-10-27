import { describe, it, expect } from "vitest";
import { contactKey, displayPhone, normalizePhone, phoneVariants } from "../lib/whatsapp/phone";

describe("normalizePhone", () => {
  it("reduces every common format to the same digits", () => {
    for (const v of ["+91 98765-43210", "919876543210", "(91) 9876543210", "0091 9876543210"]) {
      expect(normalizePhone(v)).toBe("919876543210");
    }
  });
  it("rejects values that cannot be a phone number", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone("1".repeat(16))).toBeNull();
  });
  it("lists legacy storage variants and a display form", () => {
    expect(phoneVariants("919876543210")).toEqual(["919876543210", "+919876543210"]);
    expect(displayPhone("919876543210")).toBe("+919876543210");
  });
  it("leaves business-scoped user ids alone", () => {
    expect(contactKey("IN.13491208655302741918")).toBe("IN.13491208655302741918");
    expect(contactKey("+91 98765 43210")).toBe("919876543210");
  });
});
