/**
 * Keeps a failing loop from hammering the database and flooding the logs.
 * Waits longer after each consecutive failure (up to 30 seconds), logs the first failure
 * and then at most once a minute, and explains the most common cause in plain words:
 * the database has not had the latest supabase/schema.sql applied.
 */
export function isSchemaMissing(err: any): boolean {
  // PostgREST: function / table not found in the schema cache; Postgres: undefined function / table.
  return ["PGRST202", "PGRST205", "42883", "42P01"].includes(String(err?.code ?? ""));
}

export class FailureBackoff {
  private failures = 0;
  private lastLogAt = 0;

  /** Call after a successful pass. */
  ok() {
    if (this.failures > 0) console.log(`[recovered] after ${this.failures} failed attempt(s)`);
    this.failures = 0;
  }

  /** Records a failure, logs it sparingly, and returns how many ms to wait before retrying. */
  fail(label: string, err: any, now: number = Date.now()): number {
    this.failures++;
    const wait = Math.min(30_000, 500 * 2 ** Math.min(this.failures, 6));
    if (this.failures === 1 || now - this.lastLogAt > 60_000) {
      this.lastLogAt = now;
      if (isSchemaMissing(err)) {
        console.error(
          `[${label}] The database is missing something the worker needs (${err?.message ?? err.code}). ` +
          `Run the latest supabase/schema.sql in the Supabase SQL editor. Retrying every ${wait / 1000}s until it exists.`
        );
      } else {
        console.error(`[${label}] failed, retrying in ${wait}ms:`, err?.message ?? err);
      }
    }
    return wait;
  }
}
