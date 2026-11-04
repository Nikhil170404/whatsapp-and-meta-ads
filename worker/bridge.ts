import { pushDue } from "@/lib/bridge/push";
import { FailureBackoff } from "./backoff";

/** Pushes queued WhatsApp events to ReplyKaro Unified. Safe with any number of replicas (rows are leased). */
const IDLE_MS = 1000;
const PURGE_EVERY_MS = 6 * 60 * 60 * 1000;

export function startBridgePusher(db: any, isShuttingDown: () => boolean) {
  let stopped = false;
  let delivered = 0;
  let lastPurge = 0;
  const backoff = new FailureBackoff();

  async function loop() {
    while (!stopped && !isShuttingDown()) {
      let wait = IDLE_MS;
      try {
        const s = await pushDue(db);
        backoff.ok();
        delivered += s.delivered;
        if (s.delivered + s.retried + s.dead >= 50) wait = 0; // more waiting
        if (Date.now() - lastPurge > PURGE_EVERY_MS) { lastPurge = Date.now(); await db.rpc("bridge_purge", { p_days: 7 }); }
      } catch (err) {
        wait = backoff.fail("bridge-pusher", err);
      }
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    }
  }
  void loop();
  return { stop: () => { stopped = true; }, delivered: () => delivered };
}
