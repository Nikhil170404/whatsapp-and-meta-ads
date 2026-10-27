import { queueDueBroadcasts } from "@/lib/whatsapp/broadcast-runner";

/**
 * Moves broadcasts whose scheduled time has passed into the send queue. The queue
 * worker (worker/queue.ts) picks them up within seconds.
 */
export async function runScheduledBroadcasts(supabase: any) {
  return { queued: await queueDueBroadcasts(supabase) };
}
