/**
 * Business hours and the away message. Hours are evaluated in the business's own
 * time zone, never the server's, so "open 10 to 7" means 10 to 7 where they are.
 */
export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAYS)[number];

export interface DayHours { open: boolean; from: string; to: string }
export type WeekHours = Record<DayKey, DayHours>;

export const DAY_LABELS: Record<DayKey, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};

const day = (open: boolean, from = "10:00", to = "19:00"): DayHours => ({ open, from, to });

export const PRESETS: { label: string; week: WeekHours }[] = [
  { label: "Mon–Sat, 10 AM–7 PM", week: { mon: day(true), tue: day(true), wed: day(true), thu: day(true), fri: day(true), sat: day(true), sun: day(false) } },
  { label: "Mon–Fri, 9 AM–6 PM", week: { mon: day(true, "09:00", "18:00"), tue: day(true, "09:00", "18:00"), wed: day(true, "09:00", "18:00"), thu: day(true, "09:00", "18:00"), fri: day(true, "09:00", "18:00"), sat: day(false), sun: day(false) } },
  { label: "Every day, 9 AM–9 PM", week: { mon: day(true, "09:00", "21:00"), tue: day(true, "09:00", "21:00"), wed: day(true, "09:00", "21:00"), thu: day(true, "09:00", "21:00"), fri: day(true, "09:00", "21:00"), sat: day(true, "09:00", "21:00"), sun: day(true, "09:00", "21:00") } },
];

export const DEFAULT_WEEK: WeekHours = PRESETS[0].week;
export const DEFAULT_TIMEZONE = "Asia/Kolkata";
export const DEFAULT_AWAY_MESSAGE =
  "Thanks for your message! We are closed right now and will reply as soon as we open. Reply STOP to opt out of messages.";
export const AWAY_MESSAGE_MAX = 1000;
/** An away message is sent at most once per customer in this period, so it never nags. */
export const AWAY_COOLDOWN_MS = 12 * 60 * 60 * 1000;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export function isValidTimeZone(tz: string): boolean {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

/** Returns a plain-language problem with the hours, or null if they are usable. */
export function validateHours(week: unknown, timeZone: unknown, awayMessage: unknown): string | null {
  if (typeof timeZone !== "string" || !isValidTimeZone(timeZone)) return "Choose a valid time zone.";
  if (typeof awayMessage !== "string" || !awayMessage.trim()) return "Write the away message customers will receive.";
  if (awayMessage.length > AWAY_MESSAGE_MAX) return `The away message is limited to ${AWAY_MESSAGE_MAX} characters.`;
  const w = week as Partial<WeekHours> | null;
  if (!w || typeof w !== "object") return "Set your opening hours.";
  let anyOpen = false;
  for (const d of DAYS) {
    const h = w[d];
    if (!h || typeof h.open !== "boolean") return `Set ${DAY_LABELS[d]}'s hours.`;
    if (!h.open) continue;
    anyOpen = true;
    if (!TIME_RE.test(h.from) || !TIME_RE.test(h.to)) return `${DAY_LABELS[d]} needs an opening and closing time.`;
    if (minutes(h.to) <= minutes(h.from)) return `On ${DAY_LABELS[d]}, closing time must be after opening time. Overnight hours are not supported.`;
  }
  if (!anyOpen) return "Mark at least one day as open, or switch the away message off.";
  return null;
}

/** True when the business is open at `now` in its own time zone. */
export function isOpenNow(week: WeekHours, timeZone: string, now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const key = get("weekday").toLowerCase().slice(0, 3) as DayKey;
  const today = week[key];
  if (!today?.open) return false;
  const current = Number(get("hour")) * 60 + Number(get("minute"));
  return current >= minutes(today.from) && current < minutes(today.to);
}

/** Should an away message go out now? Closed, enabled, and not already sent recently. */
export function shouldSendAway(opts: {
  enabled: boolean; week: WeekHours | null | undefined; timeZone: string | null | undefined;
  lastAwayAt: string | null | undefined; now?: Date;
}): boolean {
  const now = opts.now ?? new Date();
  if (!opts.enabled || !opts.week) return false;
  if (isOpenNow(opts.week, opts.timeZone || DEFAULT_TIMEZONE, now)) return false;
  if (opts.lastAwayAt && now.getTime() - new Date(opts.lastAwayAt).getTime() < AWAY_COOLDOWN_MS) return false;
  return true;
}
