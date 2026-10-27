/**
 * WhatsApp lets a business send free-form messages only while the customer's
 * "service window" is open: 24 hours after their last message (72 hours when
 * they came from a Click-to-WhatsApp ad). After that, only approved templates
 * can be sent. Showing this in the inbox prevents the most common mistake.
 */
export const WINDOW_MS = 24 * 60 * 60 * 1000;

export interface WindowState {
  open: boolean;
  /** When free-form messages stop being allowed (null if the customer never wrote). */
  closesAt: Date | null;
  msLeft: number;
}

export function windowState(
  lastInboundAt: string | Date | null | undefined,
  now: Date = new Date(),
  adWindowEndsAt?: string | Date | null
): WindowState {
  const candidates: Date[] = [];
  if (lastInboundAt) candidates.push(new Date(new Date(lastInboundAt).getTime() + WINDOW_MS));
  if (adWindowEndsAt) candidates.push(new Date(adWindowEndsAt));
  const valid = candidates.filter((d) => !Number.isNaN(d.getTime()));
  if (!valid.length) return { open: false, closesAt: null, msLeft: 0 };
  const closesAt = new Date(Math.max(...valid.map((d) => d.getTime())));
  const msLeft = closesAt.getTime() - now.getTime();
  return { open: msLeft > 0, closesAt, msLeft: Math.max(0, msLeft) };
}

/** "5 hours left", "40 minutes left" */
export function describeTimeLeft(msLeft: number): string {
  const minutes = Math.floor(msLeft / 60000);
  if (minutes >= 120) return `${Math.floor(minutes / 60)} hours left`;
  if (minutes >= 60) return "about 1 hour left";
  const m = Math.max(1, minutes);
  return `${m} minute${m === 1 ? "" : "s"} left`;
}
