import { normalizePhone } from "@/lib/whatsapp/phone";

/** Queue an event for .com. Does nothing if this account is not linked. Never throws: the bridge must not break WhatsApp handling. */
export async function enqueueBridge(db: any, userId: string, type: "message.inbound" | "message.outbound" | "consent.changed" | "contact.updated", dedupeKey: string, data: Record<string, unknown>): Promise<void> {
  try {
    await db.rpc("bridge_enqueue", { p_user: userId, p_type: type, p_key: dedupeKey, p_data: data });
  } catch (err) {
    console.error("[bridge] could not queue event:", (err as Error)?.message ?? err);
  }
}

export const inboundEvent = (opts: { waId: string; name?: string | null; text: string; at: string }) => ({
  wa_id: opts.waId,
  ...(opts.name ? { name: opts.name } : {}),
  ...(normalizePhone(opts.waId) ? { phone: normalizePhone(opts.waId) } : {}),
  text: opts.text.slice(0, 1000),
  at: opts.at,
});

/** STOP means no messages of any kind, so all three purposes are withdrawn. */
export const CONSENT_PURPOSES_ALL = ["marketing", "utility", "support"] as const;
