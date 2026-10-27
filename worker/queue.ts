import { nextBroadcastToRun, runBroadcastJob } from "@/lib/whatsapp/broadcast-runner";
import { FailureBackoff } from "./backoff";

/**
 * Pulls broadcasts off the queue and sends them. Each broadcast carries a lease in
 * the database, so any number of worker replicas can run this loop: they never send
 * the same broadcast twice, and a broadcast whose worker died is resumed by another.
 */
const MAX_PARALLEL = Number(process.env.BROADCAST_PARALLEL) || 2;
const POLL_MS = 3000;

export function startBroadcastQueue(db: any, isShuttingDown: () => boolean) {
  let running = 0;
  let ticking = false;
  let pausedUntil = 0;
  const backoff = new FailureBackoff();

  async function tick() {
    if (ticking || isShuttingDown() || Date.now() < pausedUntil) return;
    ticking = true;
    try {
      while (running < MAX_PARALLEL && !isShuttingDown()) {
        const id = await nextBroadcastToRun(db);
        backoff.ok();
        if (!id) break;
        running++;
        runBroadcastJob(db, id)
          .then((outcome) => {
            if (outcome) console.log(`[broadcast ${id}] ${outcome.status} sent=${outcome.sent} failed=${outcome.failed}${outcome.message ? ` (${outcome.message})` : ""}`);
          })
          .catch((err) => console.error(`[broadcast ${id}] crashed:`, err))
          .finally(() => { running--; });
        // Give the claim a moment to land so the next lookup does not return the same broadcast.
        await new Promise((r) => setTimeout(r, 250));
      }
    } catch (err) {
      pausedUntil = Date.now() + backoff.fail("broadcast-queue", err);
    } finally {
      ticking = false;
    }
  }

  const timer = setInterval(() => void tick(), POLL_MS);
  void tick();
  return { stop: () => clearInterval(timer), running: () => running };
}
