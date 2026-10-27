import { runScheduledBroadcasts } from "@/lib/jobs/scheduled-broadcasts";
import { runTokenRefresh } from "@/lib/jobs/token-refresh";
import { runQualitySync } from "@/lib/jobs/quality-sync";
import { runPurge } from "@/lib/jobs/purge";

export interface JobDefinition {
  name: string;
  /** node-cron expression, evaluated in Asia/Kolkata. */
  schedule: string;
  /** Lock lifetime; must exceed the longest expected run. */
  lockSeconds: number;
  run: (supabase: any) => Promise<unknown>;
}

export const JOBS: JobDefinition[] = [
  {
    name: "scheduled-broadcasts",
    schedule: "* * * * *", // every minute
    lockSeconds: 55 * 60,
    run: runScheduledBroadcasts,
  },
  {
    name: "token-refresh",
    schedule: "0 2 * * *", // 02:00 daily
    lockSeconds: 30 * 60,
    run: runTokenRefresh,
  },
  {
    name: "quality-sync",
    schedule: "0 */6 * * *", // every 6 hours
    lockSeconds: 30 * 60,
    run: runQualitySync,
  },
  {
    name: "retention-purge",
    schedule: "30 3 * * *", // 03:30 daily
    lockSeconds: 60 * 60,
    run: runPurge,
  },
];
