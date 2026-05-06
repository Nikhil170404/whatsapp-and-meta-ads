import crypto from "crypto";
import { logger } from "@/lib/logger";

/**
 * Timing-safe string comparison to prevent timing attacks.
 */
function safeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf-8');
    const bufB = Buffer.from(b, 'utf-8');
    if (bufA.length !== bufB.length) {
        // Burn constant time by comparing bufA against itself, then return false
        crypto.timingSafeEqual(bufA, bufA);
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verify that a request is from an authorized cron source.
 *
 * - Validates CRON_SECRET or EXTERNAL_CRON_SECRET via Authorization header
 * - Logs advisory warning if User-Agent doesn't match Vercel cron in production
 *
 * Returns { authorized: true } or { authorized: false, response: NextResponse }
 */
export function verifyCronRequest(
    request: Request
): { authorized: true } | { authorized: false; status: number; message: string } {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const externalCronSecret = process.env.EXTERNAL_CRON_SECRET;

    // Bypass auth in development mode for easier local testing
    if (process.env.NODE_ENV !== "production") {
        return { authorized: true };
    }

    // Must have at least one secret configured in production
    if (!cronSecret && !externalCronSecret) {
        logger.error("No CRON_SECRET or EXTERNAL_CRON_SECRET configured", { category: "cron" });
        return { authorized: false, status: 500, message: "Cron auth not configured" };
    }

    // Extract bearer token
    let token: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice(7);
    }

    // Validate token using timing-safe comparison
    const isValid = token && (
        (cronSecret && safeCompare(token, cronSecret)) ||
        (externalCronSecret && safeCompare(token, externalCronSecret))
    );

    if (!isValid) {
        logger.warn("Unauthorized cron request", { category: "cron" });
        return { authorized: false, status: 401, message: "Unauthorized" };
    }

    // Advisory: Check Vercel cron User-Agent in production
    if (process.env.NODE_ENV === "production") {
        const userAgent = request.headers.get("user-agent") || "";
        if (!userAgent.includes("vercel-cron")) {
            logger.warn("Cron request from non-Vercel source in production (advisory)", {
                userAgent: userAgent.substring(0, 80),
                category: "cron",
            });
        }
    }

    return { authorized: true };
}

