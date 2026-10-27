import { describe, it, expect } from "vitest";
import { buildChatLink } from "../lib/whatsapp/chat-link";

describe("buildChatLink", () => {
  it("strips formatting from the number", () => {
    expect(buildChatLink("+91 98765-43210")).toBe("https://wa.me/919876543210");
  });
  it("encodes the prefilled message", () => {
    expect(buildChatLink("919876543210", "Hi, price?")).toBe("https://wa.me/919876543210?text=Hi%2C%20price%3F");
  });
  it("returns null for a missing or invalid number", () => {
    expect(buildChatLink(null)).toBeNull();
    expect(buildChatLink("12")).toBeNull();
  });
  it("omits an empty message", () => {
    expect(buildChatLink("919876543210", "   ")).toBe("https://wa.me/919876543210");
  });
});
