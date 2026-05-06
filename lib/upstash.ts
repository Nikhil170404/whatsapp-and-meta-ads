import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { env } from "./env";

// Initialize Redis
// This works because we validated UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in env.ts
export const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL!,
    token: env.UPSTASH_REDIS_REST_TOKEN!,
});

// Create a generic rate limiter helper
export function createRateLimiter(
    prefix: string = "ratelimit",
    limit: number = 10,
    window: string = "10 s"
) {
    return new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, window as any),
        analytics: true,
        prefix,
    });
}
