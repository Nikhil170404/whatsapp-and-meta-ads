const MAX_PAUSE_HOURS = 24 * 30;

/** { wa_id, paused, until? } -> the time automations stay quiet until, or null to resume. */
export function parsePause(body: any, nowMs = Date.now()): { waId: string; until: string | null } | null {
  const waId = typeof body?.wa_id === "string" ? body.wa_id.trim().slice(0, 64) : "";
  if (!waId || typeof body?.paused !== "boolean") return null;
  if (!body.paused) return { waId, until: null };
  const asked = typeof body.until === "string" ? Date.parse(body.until) : NaN;
  const cap = nowMs + MAX_PAUSE_HOURS * 3600_000;
  const until = Number.isFinite(asked) && asked > nowMs ? Math.min(asked, cap) : nowMs + 12 * 3600_000;
  return { waId, until: new Date(until).toISOString() };
}

/** True while a contact's pause has not expired. */
export const isPausedNow = (until: string | null | undefined, nowMs = Date.now()) => !!until && Date.parse(until) > nowMs;
