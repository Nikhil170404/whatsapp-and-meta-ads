import { Redis as UpstashRedis } from "@upstash/redis";

// Primary Redis instance
export const Redis = process.env.UPSTASH_REDIS_REST_URL 
    ? new UpstashRedis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
    }) 
    : null;

// Cache for initialized clients
let clients: UpstashRedis[] | null = null;

/**
 * Get all available Redis clients for sharding
 */
export function getRedisClients(): UpstashRedis[] {
    if (clients) return clients;

    clients = [];
    
    // Check primary
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        clients.push(new UpstashRedis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN
        }));
    }

    // Check slots 2-10
    for (let i = 2; i <= 10; i++) {
        const url = process.env[`UPSTASH_REDIS_REST_URL_${i}`];
        const token = process.env[`UPSTASH_REDIS_REST_TOKEN_${i}`];
        
        if (url && token) {
            clients.push(new UpstashRedis({ url, token }));
        }
    }

    return clients;
}

/**
 * Get a consistent Redis client based on a key (Sharding)
 * This ensures the same User or Key always hits the same Redis instance.
 */
export function getConsistentRedis(key: string): UpstashRedis | null {
    const allClients = getRedisClients();
    if (allClients.length === 0) return null;
    if (allClients.length === 1) return allClients[0];

    // Fast numeric hash
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = ((hash << 5) - hash) + key.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }

    const index = Math.abs(hash) % allClients.length;
    return allClients[index];
}
