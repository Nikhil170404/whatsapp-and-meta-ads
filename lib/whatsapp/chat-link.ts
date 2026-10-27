/** Builds a click-to-chat link: https://wa.me/<number>?text=<prefilled message> */
export function buildChatLink(phoneNumber: string | null | undefined, message?: string): string | null {
  const digits = (phoneNumber ?? "").replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  const text = message?.trim();
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text.slice(0, 1000))}` : ""}`;
}
