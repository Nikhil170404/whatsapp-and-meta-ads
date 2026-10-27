import { normalizePhone } from "@/lib/whatsapp/phone";
import type { InputKind } from "./types";

export interface InputResult { ok: boolean; value: string }

/** Checks what a customer typed for a question block and tidies it. */
export function validateInput(kind: InputKind, raw: string): InputResult {
  const text = raw.trim().replace(/\s+/g, " ");
  switch (kind) {
    case "email": {
      const v = text.toLowerCase();
      return { ok: v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), value: v };
    }
    case "phone": {
      let digits = normalizePhone(text);
      // A bare 10-digit Indian mobile number has no country code: assume India (+91).
      if (digits && /^[6-9]\d{9}$/.test(digits)) digits = `91${digits}`;
      return digits ? { ok: true, value: `+${digits}` } : { ok: false, value: text };
    }
    case "number": {
      const v = text.replace(/,/g, "");
      return { ok: /^-?\d+(\.\d+)?$/.test(v), value: v };
    }
    case "name":
      return { ok: /^[\p{L}][\p{L}\p{M}\s.'-]{1,59}$/u.test(text), value: text };
    default:
      return { ok: text.length >= 1 && text.length <= 500, value: text };
  }
}

export const RETRY_HINT: Record<InputKind, string> = {
  email: "That doesn't look like an email address. Please send it like name@example.com.",
  phone: "Please send a phone number with the country code, like +919876543210.",
  number: "Please send a number, for example 25.",
  name: "Please send your name using letters only.",
  text: "Please send a reply to continue.",
};
