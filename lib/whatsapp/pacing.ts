/** Runs `fn` over `items` with at most `limit` in flight, keeping result order. */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * How long to wait after a batch so the overall pace stays at or below
 * `ratePerSecond`. A batch of 200 at 40/s should take at least 5 seconds; if it
 * already took 3, wait 2 more.
 */
export function pacingDelayMs(batchSize: number, startedAt: number, ratePerSecond: number, now: number = Date.now()): number {
  const target = (batchSize / Math.max(ratePerSecond, 0.1)) * 1000;
  return Math.max(0, Math.round(target - (now - startedAt)));
}
