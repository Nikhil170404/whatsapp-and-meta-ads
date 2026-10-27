import http from "node:http";
import { randomUUID } from "node:crypto";
import cron from "node-cron";
import { createClient } from "@supabase/supabase-js";
import { JOBS, type JobDefinition } from "./jobs";
import { startBroadcastQueue } from "./queue";
import { startWebhookConsumer } from "./webhooks";

/**
 * Railway worker: runs every scheduled and long-running job so the Vercel app
 * only renders pages and answers short API requests.
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * NEXT_PUBLIC_FACEBOOK_APP_ID, FACEBOOK_APP_SECRET (token refresh).
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase: any = createClient(url, key, { auth: { persistSession: false } });
const instanceId = `${process.env.RAILWAY_REPLICA_ID ?? "local"}-${randomUUID().slice(0, 8)}`;
const running = new Set<string>();
let shuttingDown = false;

async function execute(job: JobDefinition) {
  if (shuttingDown || running.has(job.name)) return;
  running.add(job.name);

  try {
    const { data: acquired } = await supabase.rpc("try_acquire_worker_lock", {
      p_job: job.name,
      p_owner: instanceId,
      p_ttl_seconds: job.lockSeconds,
    });
    if (!acquired) return; // another replica has this tick

    const { data: runRow } = await supabase
      .from("worker_job_runs")
      .insert({ job_name: job.name })
      .select("id")
      .single();

    try {
      const details = await job.run(supabase);
      await supabase
        .from("worker_job_runs")
        .update({ status: "ok", details, finished_at: new Date().toISOString() })
        .eq("id", runRow?.id);
      if (job.name !== "scheduled-broadcasts" || (details as any)?.processed || (details as any)?.failed) {
        console.log(`[${job.name}] ok`, JSON.stringify(details));
      }
    } catch (err: any) {
      console.error(`[${job.name}] failed:`, err);
      await supabase
        .from("worker_job_runs")
        .update({
          status: "error",
          details: { error: String(err?.message ?? err).slice(0, 500) },
          finished_at: new Date().toISOString(),
        })
        .eq("id", runRow?.id);
    } finally {
      await supabase.rpc("release_worker_lock", { p_job: job.name, p_owner: instanceId });
    }
  } catch (err) {
    console.error(`[${job.name}] scheduler error:`, err);
  } finally {
    running.delete(job.name);
  }
}

const queue = startBroadcastQueue(supabase, () => shuttingDown);
const webhooks = startWebhookConsumer(supabase, () => shuttingDown);

const tasks = JOBS.map((job) =>
  cron.schedule(job.schedule, () => void execute(job), { timezone: "Asia/Kolkata" })
);

// Health endpoint for Railway's healthcheck.
const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, instance: instanceId, jobs: JOBS.map((j) => j.name), running: [...running], broadcastsSending: queue.running(), webhooksInFlight: webhooks.busy(), webhooksProcessed: webhooks.processed() }));
    return;
  }
  res.writeHead(404).end();
});
server.listen(Number(process.env.PORT ?? 8080));

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, waiting for ${running.size + queue.running()} running job(s)`);
  tasks.forEach((t) => t.stop());
  queue.stop();
  webhooks.stop();
  server.close();
  const deadline = Date.now() + 25_000;
  while ((running.size > 0 || queue.running() > 0 || webhooks.busy() > 0) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 250));
  }
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

console.log(`Worker ${instanceId} started with ${JOBS.length} jobs`);
