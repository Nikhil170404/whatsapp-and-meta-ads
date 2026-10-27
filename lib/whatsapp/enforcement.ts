/**
 * Meta's policy enforcement arrives in the account_update webhook as violations,
 * timed restrictions and bans. Escalation (Meta docs): warning, then a 1 or 3 day
 * block on template sending, then a 5, 7 or 30 day block on all business-initiated
 * messages, then an account lock, then permanent disablement.
 */
export interface EnforcementState {
  /** Plain-language line for the dashboard. */
  summary: string;
  /** Marketing and other business-started messages must not be sent. */
  blocksBusinessInitiated: boolean;
  /** Only template sending is blocked (utility templates), not replies. */
  blocksUtilityTemplates: boolean;
  banned: boolean;
  /** When the restriction ends, if Meta gave a time. */
  until: Date | null;
}

const RESTRICTION_TEXT: Record<string, string> = {
  RESTRICTED_BIZ_INITIATED_MESSAGING: "you cannot start conversations or send templates",
  RESTRICTED_CUSTOMER_INITIATED_MESSAGING: "you cannot reply to customers",
  RESTRICTED_ADD_PHONE_NUMBER_ACTION: "you cannot add phone numbers",
  RESTRICTED_UTILITY_TEMPLATES: "you cannot send utility templates",
  RESTRICTED_DIRECT_SEND_UTILITY_TEMPLATES: "you cannot send utility templates",
};

export function parseAccountUpdate(value: any): EnforcementState | null {
  switch (value?.event) {
    case "ACCOUNT_VIOLATION": {
      const type = value.violation_info?.violation_type;
      return {
        summary: `Meta flagged a policy violation${type ? ` (${String(type).toLowerCase().replace(/_/g, " ")})` : ""}. Review it in Business Support Home before it leads to a restriction.`,
        blocksBusinessInitiated: false, blocksUtilityTemplates: false, banned: false, until: null,
      };
    }
    case "ACCOUNT_RESTRICTION": {
      const items: any[] = Array.isArray(value.restriction_info) ? value.restriction_info : [];
      const biz = items.some((i) => i.restriction_type === "RESTRICTED_BIZ_INITIATED_MESSAGING");
      const util = items.some((i) => i.restriction_type === "RESTRICTED_UTILITY_TEMPLATES" || i.restriction_type === "RESTRICTED_DIRECT_SEND_UTILITY_TEMPLATES");
      const expiries = items.map((i) => Number(i.expiration)).filter((n) => Number.isFinite(n) && n > 0);
      const until = expiries.length ? new Date(Math.max(...expiries) * 1000) : null;
      const what = items.map((i) => RESTRICTION_TEXT[i.restriction_type]).filter(Boolean);
      const when = until ? ` until ${until.toLocaleDateString("en-IN", { dateStyle: "long" })}` : "";
      return {
        summary: `Meta restricted this account${when}: ${what.length ? what.join("; ") : "some actions are limited"}. You can appeal in Business Support Home.`,
        blocksBusinessInitiated: biz, blocksUtilityTemplates: util, banned: false, until,
      };
    }
    case "DISABLED_UPDATE": {
      const state = value.ban_info?.waba_ban_state;
      if (state === "REINSTATE") return { summary: "", blocksBusinessInitiated: false, blocksUtilityTemplates: false, banned: false, until: null };
      const date = value.ban_info?.waba_ban_date;
      return {
        summary: state === "SCHEDULE_FOR_DISABLE"
          ? `Meta has scheduled this account to be disabled${date ? ` on ${date}` : ""}. Appeal in Business Support Home now.`
          : `Meta disabled this WhatsApp account${date ? ` on ${date}` : ""}. You can appeal in Business Support Home.`,
        blocksBusinessInitiated: true, blocksUtilityTemplates: true, banned: state !== "SCHEDULE_FOR_DISABLE", until: null,
      };
    }
    case "ACCOUNT_DELETED":
      return { summary: "This WhatsApp account was deleted in Meta.", blocksBusinessInitiated: true, blocksUtilityTemplates: true, banned: true, until: null };
    default:
      return null;
  }
}

/** True while a restriction that stops business-started messages is still in force. */
export function isRestricted(state: { restricted_until?: string | null; restriction_blocks?: boolean | null }, now = new Date()): boolean {
  if (!state.restriction_blocks) return false;
  return !state.restricted_until || new Date(state.restricted_until) > now;
}
