import { runFlowTimers } from "@/lib/flows/timers";
import { FailureBackoff } from "./backoff";

/** Every few seconds, continue conversations whose wait block has elapsed. */
const POLL_MS = 5000;

export function startFlowTimers(db: any, isShuttingDown: () => boolean) {
  let running = false;
  let pausedUntil = 0;
  const backoff = new FailureBackoff();

  async function tick() {
    if (running || isShuttingDown() || Date.now() < pausedUntil) return;
    running = true;
    try {
      const r = await runFlowTimers(db);
      backoff.ok();
      if (r.continued || r.expired) console.log(`[flow-timers] continued=${r.continued} expired=${r.expired}`);
    } catch (err) {
      pausedUntil = Date.now() + backoff.fail("flow-timers", err);
    } finally {
      running = false;
    }
  }

  const timer = setInterval(() => void tick(), POLL_MS);
  return { stop: () => clearInterval(timer) };
}
