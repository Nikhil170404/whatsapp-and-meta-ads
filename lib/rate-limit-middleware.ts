import { Ratelimit } from "@upstash/ratelimit";
import { NextRequest, NextResponse } from "next/server";
import { getRedisClients } from "./redis";
import { AppError, RateLimitError, formatErrorResponse, getErrorStatusCode } from "./errors";
import logger from "./logger";

// Types
interface RateLimiterConfig {
    prefix: string;
    limiters: Ratelimit[];
}

interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
}

// This is handled by getRedisClients in ./redis.ts now

// Pre-configured rate limiters
const rateLimiters: Record<string, RateLimiterConfig> = {
    // Auth endpoints - strict limit
    auth: {
        prefix: "ratelimit:auth",
        limiters: [],
    },
    // General API endpoints
    api: {
        prefix: "ratelimit:api",
        limiters: [],
    },
    // Analytics - lighter load expected
    analytics: {
        prefix: "ratelimit:analytics",
        limiters: [],
    },
    // Automations CRUD
    automations: {
        prefix: "ratelimit:automations",
        limiters: [],
    },
};

// Initialize limiters lazily
function getOrCreateLimiters(type: keyof typeof rateLimiters): Ratelimit[] {
    const config = rateLimiters[type];
    if (config.limiters.length > 0) return config.limiters;

    const redisClients = getRedisClients();
    if (redisClients.length === 0) return [];

    // Different limits for different endpoint types
    const limits: Record<string, { requests: number; window: `${number} ${"s" | "m" | "h" | "d"}` }> = {
        auth: { requests: 10, window: "1 m" },
        api: { requests: 100, window: "1 m" },
        analytics: { requests: 30, window: "1 m" },
        automations: { requests: 60, window: "1 m" },
    };

    const limit = limits[type] || limits.api;

    // Create a limiter for EACH redis client
    config.limiters = redisClients.map(client => new Ratelimit({
        redis: client,
        limiter: Ratelimit.slidingWindow(limit.requests, limit.window),
        prefix: config.prefix,
        analytics: true,
    }));

    return config.limiters;
}

/**
 * Check rate limit for a given identifier
 */
export async function checkRateLimit(
    type: keyof typeof rateLimiters,
    identifier: string
): Promise<RateLimitResult> {
    const limiters = getOrCreateLimiters(type);

    // If no limiters available, allow request
    if (limiters.length === 0) {
        return {
            success: true,
            limit: -1,
            remaining: -1,
            reset: Date.now(),
        };
    }

    // Hash the identifier to pick a CONSISTENT limiter instance
    // This ensures User A always hits Redis 1, User B always hits Redis 2, etc.
    let hash = 0;
    for (let i = 0; i < identifier.length; i++) {
        hash = ((hash << 5) - hash) + identifier.charCodeAt(i);
        hash |= 0;
    }
    const index = Math.abs(hash) % limiters.length;
    const limiter = limiters[index];

    try {
        const result = await limiter.limit(identifier);

        return {
            success: result.success,
            limit: result.limit,
            remaining: result.remaining,
            reset: result.reset,
        };
    } catch (error) {
        // On error (e.g., Redis down or quota exceeded), FAIL OPEN to keep the app working
        logger.error("Rate limit check failed (FAIL OPEN)", { type, identifier }, error as Error);
        return {
            success: true, // FAIL OPEN
            limit: -1,
            remaining: -1,
            reset: Date.now(),
        };
    }
}

/**
 * Extract rate limit identifier from request
 * Uses session user ID if available, falls back to IP
 */
export function getRateLimitIdentifier(request: NextRequest, userId?: string): string {
    if (userId) {
        return `user:${userId}`;
    }

    // Anti-Spoofing: Prioritize Vercel's true client IP headers, then fallback to forwarded
    const realIp = request.headers.get("x-real-ip");
    const forwarded = request.headers.get("x-forwarded-for");

    // Vercel strips malicious x-forwarded-for and injects its own real IP header.
    // If running outside Vercel, take the FIRST IP in the forwarded chain (the client),
    // but prioritize x-real-ip as the primary trusted header.
    const ip = realIp ||
        forwarded?.split(",")[0].trim() ||
        "unknown";

    return `ip:${ip}`;
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
    response: NextResponse,
    result: RateLimitResult
): NextResponse {
    if (result.limit > 0) {
        response.headers.set("X-RateLimit-Limit", result.limit.toString());
        response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
        response.headers.set("X-RateLimit-Reset", result.reset.toString());
    }
    return response;
}

/**
 * Rate limit middleware for API routes
 * Use in API route handlers
 */
export async function withRateLimit<T>(
    request: NextRequest,
    type: keyof typeof rateLimiters,
    userId: string | undefined,
    handler: () => Promise<T>
): Promise<T | NextResponse> {
    const identifier = getRateLimitIdentifier(request, userId);
    const result = await checkRateLimit(type, identifier);

    if (!result.success) {
        const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);

        logger.warn("Rate limit exceeded", {
            type,
            identifier,
            retryAfter,
        });

        const response = NextResponse.json(
            formatErrorResponse(new RateLimitError("Rate limit exceeded", retryAfter)),
            { status: 429 }
        );

        response.headers.set("Retry-After", retryAfter.toString());
        return addRateLimitHeaders(response, result);
    }

    return handler();
}

/**
 * Higher-order function to wrap API handlers with rate limiting
 */
export function createRateLimitedHandler(
    type: keyof typeof rateLimiters,
    getUserId: (request: NextRequest) => string | undefined | Promise<string | undefined>
) {
    return function (
        handler: (request: NextRequest, context?: any) => Promise<NextResponse<any>> | NextResponse<any>
    ) {
        return async (request: NextRequest, context?: any): Promise<NextResponse> => {
            const userId = await getUserId(request);
            const identifier = getRateLimitIdentifier(request, userId);
            const result = await checkRateLimit(type, identifier);

            if (!result.success) {
                const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);

                const response = NextResponse.json(
                    formatErrorResponse(new RateLimitError("Rate limit exceeded", retryAfter)),
                    { status: 429 }
                );

                response.headers.set("Retry-After", retryAfter.toString());
                return addRateLimitHeaders(response, result);
            }

            const response = await handler(request, context);
            return addRateLimitHeaders(response, result);
        };
    };
}

export type { RateLimitResult };
