/**
 * What to do when Meta rejects a send. Codes and meanings are from Meta's
 * Cloud API error-code reference. Each code maps to one action so a broadcast
 * reacts correctly: stop and explain, slow down, skip the person, or record a failure.
 */
export type ErrorAction =
  | { action: "abort"; reason: string; tokenExpired?: boolean; templateProblem?: boolean }
  | { action: "throttle" }
  | { action: "skip"; reason: string; marketingOptOut?: boolean }
  | { action: "fail"; reason: string };

export function classifyMetaError(code: number | undefined, message = ""): ErrorAction {
  switch (code) {
    // Stop the whole broadcast: continuing would repeat the same failure for everyone.
    case 190:
    case 131005:
      return { action: "abort", tokenExpired: true, reason: "Your WhatsApp connection expired. Reconnect it, then press Send to continue where it stopped." };
    case 131042:
      return { action: "abort", reason: "Meta cannot charge your account. Add a payment method in Meta Business Manager, then press Send to continue." };
    case 131031:
    case 368:
      return { action: "abort", reason: "Meta has restricted or disabled this WhatsApp account for a policy violation. Open Business Support Home in Meta to see why and to appeal." };
    case 131048:
      return { action: "abort", reason: "Meta has limited sending from this number, usually because too many people blocked or reported messages. Check your quality status in WhatsApp Manager before sending more." };
    case 132015:
      return { action: "abort", templateProblem: true, reason: "Meta paused this template because of low quality. Edit it or create a new one." };
    case 132016:
      return { action: "abort", templateProblem: true, reason: "Meta permanently disabled this template after repeated low quality. Create a new template with different content." };
    case 132001:
      return { action: "abort", templateProblem: true, reason: "Meta cannot find this template in that language, or it is not approved." };
    case 132000:
    case 132012:
      return { action: "abort", templateProblem: true, reason: "Meta rejected the template values. Check that every variable is filled in correctly." };
    case 132007:
      return { action: "abort", templateProblem: true, reason: "Meta says the template content breaks WhatsApp policy. Rewrite it and submit again." };
    case 133010:
      return { action: "abort", reason: "This phone number is not registered on the WhatsApp Business Platform." };

    // Slow down and retry: not a problem with the recipient.
    case 130429: // Cloud API throughput reached
    case 80007:  // account-level rate limit
    case 131057: // account in maintenance (for example during a throughput upgrade)
      return { action: "throttle" };

    // Skip this person; the rest of the broadcast continues.
    case 131049:
      return { action: "skip", reason: "Meta limited promotional messages to this person right now. Try again after 24 hours." };
    case 131050:
      return { action: "skip", marketingOptOut: true, reason: "This person stopped promotional messages from you in WhatsApp." };
    case 131056:
      return { action: "skip", reason: "Too many messages to this person in a short time. Try again later." };
    case 131026:
      return { action: "skip", reason: "Could not be delivered: the number may not be on WhatsApp or the app is out of date." };
    case 131047:
      return { action: "skip", reason: "More than 24 hours since this person last wrote, so a template is needed." };
    default:
      return { action: "fail", reason: message ? message.slice(0, 200) : "Unknown error" };
  }
}
