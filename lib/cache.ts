import { logger } from "@/lib/logger";
import { getConsistentRedis } from "./redis";

// Fallback in-memory cache for development
const memoryCache = new Map<string, { data: unknown; expiresAt: number }>();
const DEFAULT_TTL = 300; // 5 minutes in seconds

/**
 * Get cached item from Redis (or memory fallback)
 */
export async function getCached<T>(key: string): Promise<T | null> {
    const client = getConsistentRedis(key);

    if (client) {
        try {
            const data = await client.get<T>(key);
            return data;
        } catch (error) {
            logger.error("Redis GET error", { category: "cache" }, error as Error);
            return null;
        }
    }

    // Memory fallback for development
    const entry = memoryCache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
        memoryCache.delete(key);
        return null;
    }
    return entry.data as T;
}

/**
 * Set cached item in Redis (or memory fallback)
 */
export async function setCached<T>(key: string, data: T, ttlSeconds = DEFAULT_TTL): Promise<void> {
    const client = getConsistentRedis(key);

    if (client) {
        try {
            await client.setex(key, ttlSeconds, JSON.stringify(data));
            return;
        } catch (error) {
            logger.error("Redis SET error", { category: "cache" }, error as Error);
        }
    }

    // Memory fallback for development
    memoryCache.set(key, {
        data,
        expiresAt: Date.now() + (ttlSeconds * 1000)
    });

    // Size management: Clear oldest if cache grows too large (> 1000 items)
    if (memoryCache.size > 1000) {
        const firstKey = memoryCache.keys().next().value;
        if (firstKey) memoryCache.delete(firstKey);
    }
}

/**
 * Delete cached item
 */
export async function deleteCached(key: string): Promise<void> {
    const client = getConsistentRedis(key);

    if (client) {
        try {
            await client.del(key);
        } catch (error) {
            logger.error("Redis DEL error", { category: "cache" }, error as Error);
        }
    }

    memoryCache.delete(key);
}

// User-specific cache helpers
export interface CachedUser {
    id: string;
    fb_access_token: string;
    facebook_user_id: string;
    display_name?: string;
    plan_type: string;
    plan_expires_at?: string;
    created_at: string;
}

export const getCachedUser = (id: string) => getCached<CachedUser>(`user:${id}`);
export const setCachedUser = (id: string, data: CachedUser) => setCached(`user:${id}`, data);
export const clearUserCache = (id: string) => deleteCached(`user:${id}`);

// Automation-specific cache helpers
export interface CachedAutomation {
    id: string;
    user_id: string;
    media_id: string;
    trigger_keyword?: string;
    trigger_type: string;
    reply_message: string;
    comment_reply?: string;
    comment_reply_templates?: string[];
    button_text?: string;
    link_url?: string;
    require_follow: boolean;
    is_active: boolean;
    media_thumbnail_url?: string | null;
    media_url?: string | null;
    follow_gate_message?: string;
    final_message?: string;
    final_button_text?: string;
    created_at: string;
    respond_to_replies?: boolean;
    ignore_self_comments?: boolean;
    fan_mode?: boolean;
    fan_rewards?: Array<{ points: number; title: string; link: string }>;
}

export const getCachedAutomation = (key: string) => getCached<CachedAutomation>(key);
export const setCachedAutomation = (key: string, data: CachedAutomation) => setCached(key, data);
export const clearAutomationCache = (key: string) => deleteCached(key);

// Frequency Capping (24h)
export async function checkFrequencyCap(creatorId: string, commenterId: string, automationId: string): Promise<boolean> {
    const key = `freq:${creatorId}:${commenterId}:${automationId}`;
    const client = getConsistentRedis(key);
    if (!client) return false; // Fail open

    try {
        const exists = await client.get(key);
        return !!exists;
    } catch (error) {
        logger.error("Redis freq check error", { category: "cache" }, error as Error);
        return false;
    }
}

export async function setFrequencyCap(creatorId: string, commenterId: string, automationId: string): Promise<void> {
    const key = `freq:${creatorId}:${commenterId}:${automationId}`;
    const client = getConsistentRedis(key);
    if (!client) return;

    try {
        // Set for 24 hours
        await client.setex(key, 86400, "1");
    } catch (error) {
        logger.error("Redis freq set error", { category: "cache" }, error as Error);
    }
}
