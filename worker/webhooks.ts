import { processWebhookBody } from "@/lib/whatsapp/webhook-processor";
import { mapWithConcurrency } from "@/lib/whatsapp/pacing";
import { FailureBackoff } from "./backoff";

/**
 * Consumes the webhook queue. The web endpoint only stores payloads; this does the work.
 *
 * - Events are claimed in batches; any number of worker replicas can run this loop.
 * - Events for the same business phone number run in order (a customer's messages stay in
 *   sequence); different numbers run in parallel.
 * - A failed event goes back in line and is retried; after 5 attempts it is parked as
 *   "dead" for inspection instead of blocking the queue.
 */
const BATCH = Number(process.env.WEBHOOK_BATCH) || 50;
const CONCURRENCY = Number(process.env.WEBHOOK_CONCURRENCY) || 8;
const IDLE_MS = 500;

interface QueuedEvent { id: number; payload: any; attempts: number }

const groupKey = (e: QueuedEvent) =>
  e.payload?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ?? e.payload?.entry?.[0]?.id ?? "other";

export function startWebhookConsumer(db: any, isShuttingDown: () => boolean) {
  let busy = 0;
  let stopped = false;
  let processed = 0;
  const backoff = new FailureBackoff();

  async function handle(e: QueuedEvent) {
    try {
      await processWebhookBody(db, e.payload);
      await db.rpc("finish_webhook_event", { p_id: e.id, p_error: null });
      processed++;
    } catch (err: any) {
      console.error(`[webhook ${e.id}] failed (attempt ${e.attempts}):`, err?.message ?? err);
      await db.rpc("finish_webhook_event", { p_id: e.id, p_error: String(err?.message ?? err) });
    }
  }

  async function loop() {
    while (!stopped && !isShuttingDown()) {
      let claimed = 0;
      let waitMs = 0;
      try {
        const { data, error } = await db.rpc("claim_webhook_events", { p_limit: BATCH, p_lease_seconds: 120 });
        if (error) throw error;
        const events: QueuedEvent[] = data ?? [];
        claimed = events.length;
        backoff.ok();
        if (claimed) {
          busy += claimed;
          const groups = new Map<string, QueuedEvent[]>();
          for (const e of events) groups.set(groupKey(e), [...(groups.get(groupKey(e)) ?? []), e]);
          await mapWithConcurrency([...groups.values()], CONCURRENCY, async (list) => {
            for (const e of list) await handle(e); // in order within a number
          });
          busy -= claimed;
        }
      } catch (err) {
        waitMs = backoff.fail("webhook-consumer", err);
      }
      // Drain quickly while there is work; rest briefly when the queue is empty or after a failure.
      if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
      else if (claimed < BATCH) await new Promise((r) => setTimeout(r, IDLE_MS));
    }
  }

  void loop();
  return { stop: () => { stopped = true; }, busy: () => busy, processed: () => processed };
}
