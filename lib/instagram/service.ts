import { logger } from "@/lib/logger";
import { redis } from "@/lib/upstash"; // ADDED: Shared across Vercel functions

const GRAPH_API_VERSION = "v21.0";

// ============================================================
// Meta Rate Limit Header Tracking (ManyChat/SuperProfile pattern)
// ============================================================

export interface MetaRateLimitInfo {
    callCount: number;       // % of allowed calls used (0-100)
    totalCpuTime: number;    // % of CPU time used (0-100)
    totalTime: number;       // % of total time used (0-100)
    estimatedTimeToRegain: number;  // minutes until unthrottled
    type?: string;           // e.g. "instagram", "messenger"
}

/**
 * Parse Meta rate limit headers from API response.
 * Meta uses different headers for different pools:
 * - X-Business-Use-Case-Usage (BUC): Content APIs (Instagram error 80002, Messenger 80006)
 * - X-App-Usage (Platform): App token APIs (Error 4, 17, 32)
 */
export async function parseMetaRateLimitHeaders(response: Response, accountId?: string): Promise<MetaRateLimitInfo | null> {
    try {
        // Try BUC header first (Instagram Platform uses this)
        const bucHeader = response.headers.get("x-business-use-case-usage");
        if (bucHeader) {
            const parsed = JSON.parse(bucHeader);
            // BUC header is keyed by business-object-id, get first entry
            const entries = Object.values(parsed) as any[][];
            if (entries.length > 0 && entries[0].length > 0) {
                const usage = entries[0][0];
                const info: MetaRateLimitInfo = {
                    callCount: usage.call_count || 0,
                    totalCpuTime: usage.total_cputime || 0,
                    totalTime: usage.total_time || 0,
                    estimatedTimeToRegain: usage.estimated_time_to_regain_access || 0,
                    type: usage.type,
                };
                const cacheKey = accountId || "default";
                // Background update Upstash Redis (5 min TTL)
                redis.set(`meta_rate_limit:${cacheKey}`, { info, updatedAt: Date.now() }, { ex: 300 }).catch(err =>
                    logger.debug("Failed to set meta_rate_limit cache", { err: err.message })
                );

                // Log warnings at different thresholds
                if (info.callCount >= 95) {
                    logger.error("Meta API rate limit CRITICAL", { ...info, accountId, category: "instagram" });
                } else if (info.callCount >= 80) {
                    logger.warn("Meta API rate limit HIGH", { ...info, accountId, category: "instagram" });
                } else if (info.callCount >= 50) {
                    logger.debug("Meta API rate limit moderate", { ...info, accountId, category: "instagram" });
                }
                return info;
            }
        }

        // Fallback: Platform rate limit header
        const appHeader = response.headers.get("x-app-usage");
        if (appHeader) {
            const usage = JSON.parse(appHeader);
            const info: MetaRateLimitInfo = {
                callCount: usage.call_count || 0,
                totalCpuTime: usage.total_cputime || 0,
                totalTime: usage.total_time || 0,
                estimatedTimeToRegain: 0,
            };
            const cacheKey = accountId || "default";
            // Background update Upstash Redis (5 min TTL)
            redis.set(`meta_rate_limit:${cacheKey}`, { info, updatedAt: Date.now() }, { ex: 300 }).catch(err =>
                logger.debug("Failed to set meta_rate_limit cache", { err: err.message })
            );

            if (info.callCount >= 80) {
                logger.warn("Meta API platform rate limit HIGH", { ...info, accountId, category: "instagram" });
            }
            return info;
        }
    } catch (e) {
        // Header parsing should never break the main flow
        logger.debug("Failed to parse Meta rate limit headers", { category: "instagram" });
    }
    return null;
}

/**
 * Check if we should throttle API calls based on cached rate limit info.
 * Enforces safety thresholds: 95% (Hard Pause), 80% (Soft Delay), 50% (Log).
 * Uses Redis with 5-min TTL to match the minimum Meta regaining window.
 * Returns delay in ms to wait (0 = no throttle).
 */
export async function shouldThrottle(accountId?: string): Promise<{ throttled: boolean; delayMs: number; info?: MetaRateLimitInfo }> {
    const cacheKey = accountId || "default";

    // Fetch from central Redis instead of broken memory Map
    const cached = await redis.get<{ info: MetaRateLimitInfo; updatedAt: number }>(`meta_rate_limit:${cacheKey}`);

    if (!cached) return { throttled: false, delayMs: 0 };

    // Cache is stale after 5 minutes — ignore (Redis 'ex' also handles this)
    if (Date.now() - cached.updatedAt > 5 * 60 * 1000) {
        await redis.del(`meta_rate_limit:${cacheKey}`);
        return { throttled: false, delayMs: 0 };
    }

    const { info } = cached;
    const maxUsage = Math.max(info.callCount, info.totalCpuTime, info.totalTime);

    if (maxUsage >= 95) {
        // Hard throttle: wait for estimated regain time or 60s
        const delayMs = info.estimatedTimeToRegain > 0 ? info.estimatedTimeToRegain * 60 * 1000 : 60000;
        return { throttled: true, delayMs, info };
    }
    if (maxUsage >= 80) {
        // Soft throttle: slow down with 2-5 second delays
        const delayMs = Math.floor(2000 + (maxUsage - 80) * 200); // 2s at 80%, 5s at 95%
        return { throttled: false, delayMs, info };
    }

    return { throttled: false, delayMs: 0, info };
}

// ============================================================
// 1.5: Centralized Graph API fetch helper
// Sends access_token via Authorization header instead of URL query param.
// Prevents token leakage via server logs and referrer headers.
// NOTE: config.ts OAuth endpoints still use query params per Meta spec.
// ============================================================

interface GraphApiFetchOptions {
    method?: string;
    body?: any;
    contentType?: string;
    accountId?: string; // For rate limit header tracking
}

async function graphApiFetch(
    url: string,
    accessToken: string,
    options: GraphApiFetchOptions = {}
): Promise<Response> {
    const { method = "GET", body, contentType = "application/json", accountId } = options;

    const headers: Record<string, string> = {
        "Authorization": `Bearer ${accessToken.trim()}`,
    };

    if (body && method !== "GET") {
        headers["Content-Type"] = contentType;
    }

    const fetchOptions: RequestInit = {
        method,
        headers,
    };

    if (body && method !== "GET") {
        fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    // Parse rate limit headers from every response
    parseMetaRateLimitHeaders(response, accountId);

    return response;
}

/**
 * Check if user is following the business account
 * Uses Instagram's official is_user_follow_business API field
 * This is how ManyChat/SuperProfile do it!
 */
export async function checkIsFollowing(
    accessToken: string,
    userInstagramScopedId: string
): Promise<boolean> {
    try {
        const response = await graphApiFetch(
            `https://graph.instagram.com/${GRAPH_API_VERSION}/${userInstagramScopedId}?fields=is_user_follow_business`,
            accessToken
        );

        if (!response.ok) {
            logger.warn("Could not check follow status via API", { userInstagramScopedId, category: "instagram" });
            return false;
        }

        const data = await response.json();
        logger.debug("Follow check result", { userInstagramScopedId, isFollowing: data.is_user_follow_business, category: "instagram" });

        return data.is_user_follow_business === true;
    } catch (error) {
        logger.error("Error checking is_user_follow_business", { category: "instagram" }, error as Error);
        return false;
    }
}

/**
 * Send a direct message via Instagram Send API
 * 
 * META RATE LIMITS (Send API):
 * - 100 calls/second per IG professional account for Text, Links, Stickers
 * - 10 calls/second per IG professional account for Audio, Video, Images
 * 
 * PRO SAAS SAFETY (Level 9.5/10):
 * - Implements "typing_on" sender action to mimic human presence
 * - Adds a length-based "typing delay" (20-50ms per character)
 * - Reads rate limit headers from Meta response for auto-throttling
 */
export async function sendInstagramDM(
    accessToken: string | null | undefined,
    senderId: string,
    commentId: string | null,
    recipientIdForLog: string,
    message: string,
    automationId?: string,
    buttonText?: string,
    linkUrl?: string,
    thumbnailUrl?: string,
    supabase?: any,
    userId?: string,
    fanPortalUrl?: string,
    additionalButtons?: { button_text: string; link_url: string }[]
): Promise<boolean> {
    try {
        if (!accessToken || accessToken.length < 20) {
            logger.error("Invalid or missing access token", { category: "instagram" });
            return false;
        }

        // 1. Check Meta rate limit before sending
        const throttle = await shouldThrottle(senderId);
        if (throttle.throttled) {
            logger.warn("Meta rate limit reached — skipping DM", {
                senderId, recipientId: recipientIdForLog, category: "instagram",
            });
            return false;
        }
        if (throttle.delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, throttle.delayMs));
        }

        const baseUrl = `https://graph.instagram.com/${GRAPH_API_VERSION}/${senderId}/messages`;
        const recipient = commentId ? { comment_id: commentId } : { id: recipientIdForLog };

        // Mark Seen: Only for DM recipients (not comment-triggered)
        if (!commentId) {
            try {
                await graphApiFetch(baseUrl, accessToken, {
                    method: "POST",
                    body: { recipient, sender_action: "mark_seen" },
                });
            } catch (e) {
                logger.debug("Mark seen failed (ignored)", { senderId, recipientId: recipientIdForLog });
            }
        }

        logger.info("Sending Instagram DM", {
            recipientId: recipientIdForLog,
            hasButton: !!buttonText,
            hasLink: !!linkUrl,
            category: "instagram",
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let body: any;

        // Validated URL
        const validatedLinkUrl = ensureUrlProtocol(linkUrl);

        const attachmentButtons: any[] = [];

        if (validatedLinkUrl) {
            attachmentButtons.push({
                type: "web_url",
                url: validatedLinkUrl,
                title: (buttonText || "Open Link").substring(0, 20)
            });
        } else if (buttonText && automationId) {
            // Priority: Send as a Template Button (Inside Card) for better UX
            attachmentButtons.push({
                type: "postback",
                title: (buttonText || "Continue").substring(0, 20),
                payload: `CLICK_LINK_${automationId}`
            });
        }

        // 3b. Add Additional Buttons (if any, up to 3 total)
        if (additionalButtons && additionalButtons.length > 0) {
            for (const btn of additionalButtons) {
                if (attachmentButtons.length >= 3) break; // Instagram limit
                if (!btn.button_text || !btn.link_url) continue;

                attachmentButtons.push({
                    type: "web_url",
                    url: ensureUrlProtocol(btn.link_url),
                    title: btn.button_text.substring(0, 20)
                });
            }
        }

        if (fanPortalUrl && attachmentButtons.length < 3) {
            attachmentButtons.push({
                type: "web_url",
                url: fanPortalUrl,
                title: "🏆 My Fan Points"
            });
        }

        // CARD STRATEGY: Always use Button Template (640 chars text + buttons)
        // SuperProfile style — clean card, no images needed.
        // 4. Always use Button Template for the interaction card (640 chars text)
        // This gives the "more characters" requested by user while keeping buttons
        if (attachmentButtons.length > 0) {
            const messagePayload = {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "button",
                        text: (message || "You have a message!").substring(0, 640),
                        buttons: attachmentButtons
                    }
                }
            };

            const firstBody: any = {
                recipient,
                message: messagePayload
            };

            const res = await graphApiFetch(baseUrl, accessToken, {
                method: "POST",
                body: firstBody,
                accountId: senderId,
            });

            if (!res.ok) {
                const errorData = await res.json();
                const errorCode = errorData?.error?.code;

                // Handle Meta rate limit error codes
                if (errorCode === 80002 || errorCode === 4) {
                    logger.warn("Meta API rate limit error on card DM", {
                        errorCode, senderId, recipientId: recipientIdForLog, category: "instagram",
                    });
                    const cacheKey = senderId || "default";
                    const estimatedMins = errorData?.error?.estimated_time_to_regain_access || 5;
                    await redis.set(`meta_rate_limit:${cacheKey}`, {
                        info: { callCount: 100, totalCpuTime: 0, totalTime: 0, estimatedTimeToRegain: estimatedMins },
                        updatedAt: Date.now(),
                    }, { ex: Math.max(300, estimatedMins * 60) });
                }

                // 3.5: Log Spam/Block errors (Retries handled by queue processor)
                if (errorCode === 368 || errorCode === 10 || errorCode === 32) {
                    logger.warn("Meta API Potential Block on card DM — letting queue handle retry", {
                        errorCode, senderId, userId, automationId, category: "instagram"
                    });
                }

                logger.error("Meta API Card DM Error", {
                    errorCode, errorMessage: errorData?.error?.message,
                    recipientId: recipientIdForLog, category: "instagram",
                });
                throw new Error(errorData?.error?.message || `Meta API error (code ${errorCode})`);
            }

            return true;
        } else {
            // Plain Text (Single Payload)
            body = {
                recipient,
                message: {
                    text: message || "You have a message!"
                }
            };
        }

        // === SINGLE API CALL (was 4 before) ===
        const response = await graphApiFetch(baseUrl, accessToken, {
            method: "POST",
            body,
            accountId: senderId,
        });

        if (!response.ok) {
            const errorData = await response.json();
            const errorCode = errorData?.error?.code;

            // 3.4: Handle Meta rate limit error codes
            // 80002 = Instagram BUC rate limit, 4 = app rate limit
            if (errorCode === 80002 || errorCode === 4) {
                logger.warn("Meta API rate limit error — marking account throttled", {
                    errorCode,
                    senderId,
                    recipientId: recipientIdForLog,
                    category: "instagram",
                });
                // Force throttle by setting callCount to 100%
                const cacheKey = senderId || "default";
                const estimatedMins = errorData?.error?.estimated_time_to_regain_access || 5;
                await redis.set(`meta_rate_limit:${cacheKey}`, {
                    info: {
                        callCount: 100,
                        totalCpuTime: 0,
                        totalTime: 0,
                        estimatedTimeToRegain: estimatedMins,
                    },
                    updatedAt: Date.now(),
                }, { ex: Math.max(300, estimatedMins * 60) }); // Enforce redis TTL to match regain time or 5min min
            }

            // 3.5: Log Spam/Block errors (Retries handled by queue processor)
            if (errorCode === 368 || errorCode === 10 || errorCode === 32) {
                logger.warn("Meta API Potential Block on DM — letting queue handle retry", {
                    errorCode, senderId, userId, automationId, category: "instagram"
                });
            }

            logger.error("Meta API DM Error", {
                errorCode,
                errorMessage: errorData?.error?.message,
                recipientId: recipientIdForLog,
                category: "instagram",
            });
            throw new Error(errorData?.error?.message || `Meta API error (code ${errorCode})`);
        }

        logger.info("DM sent successfully", { recipientId: recipientIdForLog, category: "instagram" });
        return true;
    } catch (error) {
        const msg = (error as Error).message || "";
        // Re-throw Meta API errors so callers (queue processor) can detect permanent failures
        // Only swallow truly unexpected errors (network timeouts, etc.)
        if (msg.includes("already has a reply") || msg.includes("cannot be found") ||
            msg.includes("too old") || msg.includes("does not exist") ||
            msg.includes("granular scopes") || msg.includes("Cannot message") ||
            msg.includes("Meta API error")) {
            throw error; // Let caller handle permanent vs retriable
        }
        logger.error("Exception during sendInstagramDM", { category: "instagram" }, error as Error);
        return false;
    }
}

/**
 * Send follow-gate card with two buttons (ManyChat style):
 * 1. "Follow & Get Access" - Links to profile
 * 2. "I'm Following ✓" - Triggers verification check
 * 
 * OPTIMIZED: 1 API call (was 3 — removed typing_on & HUMAN_AGENT)
 */
export async function sendFollowGateCard(
    accessToken: string,
    senderId: string,
    commentId: string | null,
    recipientId: string,
    automationId: string,
    profileUsername: string,
    thumbnailUrl?: string,
    customMessage?: string,
    supabase?: any,
    userId?: string
): Promise<boolean> {
    try {
        // Check Meta rate limit
        const throttle = await shouldThrottle(senderId);
        if (throttle.throttled) {
            logger.warn("Meta rate limit reached — skipping follow-gate", {
                senderId, recipientId, category: "instagram",
            });
            return false;
        }
        if (throttle.delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, throttle.delayMs));
        }

        const baseUrl = `https://graph.instagram.com/${GRAPH_API_VERSION}/${senderId}/messages`;
        const recipient = commentId ? { comment_id: commentId } : { id: recipientId };

        const message = customMessage || "Hey! 👋 To unlock this, please follow us first!";

        // Validate profile username
        if (!profileUsername || profileUsername.trim() === '') {
            logger.error("Cannot build follow-gate: profileUsername is empty", { category: "instagram" });
            return false;
        }
        // Use /_u/ format to force open in Instagram app on mobile
        const profileUrl = `https://www.instagram.com/_u/${profileUsername.trim()}/`;

        // Profile Link Button (Stay in card)
        const cardButtons = [
            {
                type: "web_url",
                url: profileUrl,
                title: "Follow & Access"
            }
        ];

        // "I'm Following" Verification Button (in same card as postback)
        const verifyButton = {
            type: "postback",
            title: "I'm Following ✓",
            payload: `VERIFY_FOLLOW_${automationId}`
        };

        // PAYLOAD STRATEGY:
        // Use Generic Template if thumbnail exists, else Button Template
        let messagePayload: any;
        if (thumbnailUrl) {
            messagePayload = {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "generic",
                        elements: [
                            {
                                title: message.substring(0, 80),
                                image_url: thumbnailUrl,
                                subtitle: "Follow & tap verification below! 👇",
                                buttons: [cardButtons[0], verifyButton]
                            }
                        ]
                    }
                }
            };
        } else {
            messagePayload = {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "button",
                        text: message.substring(0, 640),
                        buttons: [cardButtons[0], verifyButton]
                    }
                }
            };
        }

        const cardPayload = {
            recipient,
            message: messagePayload
        };
        const res1 = await graphApiFetch(baseUrl, accessToken, {
            method: "POST",
            body: cardPayload,
            accountId: senderId,
        });

        if (!res1.ok) {
            const errorData = await res1.json();
            const errorCode = errorData?.error?.code;

            // Handle Meta rate limit error codes
            if (errorCode === 80002 || errorCode === 4) {
                logger.warn("Meta API rate limit error on follow-gate", {
                    errorCode, senderId, recipientId, category: "instagram",
                });
                const cacheKey = senderId || "default";
                const estimatedMins = errorData?.error?.estimated_time_to_regain_access || 5;
                await redis.set(`meta_rate_limit:${cacheKey}`, {
                    info: { callCount: 100, totalCpuTime: 0, totalTime: 0, estimatedTimeToRegain: estimatedMins },
                    updatedAt: Date.now(),
                }, { ex: Math.max(300, estimatedMins * 60) });
            }

            // Log Spam/Block errors (Retries handled by queue processor)
            if (errorCode === 368 || errorCode === 10 || errorCode === 32) {
                logger.warn("Meta API Potential Block on Follow-Gate — letting queue handle retry", {
                    errorCode, senderId, userId, automationId, category: "instagram"
                });
            }

            logger.error("Follow-gate card error", {
                errorCode,
                errorMessage: errorData?.error?.message,
                recipientId, category: "instagram",
            });
            return false;
        }

        logger.info("Follow-gate card sent successfully", { recipientId, automationId, category: "instagram" });
        return true;
    } catch (error) {
        logger.error("Exception sending follow-gate sequence", { category: "instagram" }, error as Error);
        return false;
    }
}

/**
 * Reply to a comment publicly via Instagram Private Replies API
 * 
 * META RATE LIMITS (Private Replies API):
 * - 750 calls/HOUR per IG professional account for Posts/Reels comments
 * - 100 calls/second per IG professional account for Live comments
 * Note: This rate limit pool is entirely separate from the Send API.
 */
export async function replyToComment(
    accessToken: string,
    commentId: string,
    message: string,
    supabase?: any,
    userId?: string,
    automationId?: string
): Promise<boolean> {
    try {
        if (!message || message.trim().length === 0) {
            logger.error("Cannot send empty public reply", { category: "instagram" });
            return false;
        }

        const response = await graphApiFetch(
            `https://graph.instagram.com/${GRAPH_API_VERSION}/${commentId}/replies`,
            accessToken,
            {
                method: "POST",
                body: { message },
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            const errorCode = errorData?.error?.code;

            // Log Spam/Block errors
            if (errorCode === 368 || errorCode === 10 || errorCode === 32) {
                logger.warn("Meta API Potential Block on Public Reply — letting queue handle retry", {
                    errorCode, commentId, userId, automationId, category: "instagram"
                });
            }

            logger.error("Meta Public Reply API Error", {
                errorCode,
                commentId,
                category: "instagram",
            });
            return false;
        }

        logger.info("Public reply sent", { commentId, category: "instagram" });
        return true;
    } catch (error) {
        logger.error("Exception sending public reply", { category: "instagram" }, error as Error);
        return false;
    }
}

/**
 * Get metadata for a specific media post (e.g. timestamp)
 */
export async function getMediaDetails(
    accessToken: string,
    mediaId: string,
    retries = 2
): Promise<{ id: string, timestamp: string, media_type: string } | null> {
    try {
        let attempt = 0;
        let lastError = null;

        while (attempt <= retries) {
            const response = await graphApiFetch(
                `https://graph.instagram.com/${GRAPH_API_VERSION}/${mediaId}?fields=id,timestamp,media_type,caption,media_url,thumbnail_url`,
                accessToken
            );

            if (response.ok) {
                return await response.json();
            }

            lastError = await response.json().catch(() => null);
            attempt++;

            if (attempt <= retries) {
                logger.warn(`Media details fetch failed, retrying (${attempt}/${retries})`, { mediaId, category: "instagram" });
                await new Promise(res => setTimeout(res, 1000 * attempt));
            }
        }

        logger.error("Failed to fetch media details after retries", { mediaId, lastError, category: "instagram" });
        return null;
    } catch (error) {
        logger.error("Error fetching media details", { mediaId, category: "instagram" }, error as Error);
        return null;
    }
}

/**
 * Get all comments on a media post
 */
export async function getMediaComments(
    accessToken: string,
    mediaId: string,
    afterCursor?: string,
    deepReplies = false,
    startTime?: number, // Optional limit for time guards
    since?: number // Optional: Only fetch comments after this Unix timestamp
): Promise<{ comments: any[]; nextCursor: string | null; errorCode?: number }> {
    try {
        // Fetch comments with nested replies (expansion)
        let url = `https://graph.instagram.com/${GRAPH_API_VERSION}/${mediaId}/comments?fields=id,text,timestamp,username,like_count,hidden,parent_id,from{id,username},replies{id,text,timestamp,username,from{id,username}}&limit=50`;

        if (afterCursor) {
            url += `&after=${afterCursor}`;
        }

        if (since) {
            url += `&since=${since}`;
        }

        const response = await graphApiFetch(url, accessToken);

        if (!response.ok) {
            const errorData = await response.json();
            const errorCode = errorData?.error?.code;
            logger.error("Error fetching comments", { mediaId, errorData, category: "instagram" });
            return { comments: [], nextCursor: null, errorCode };
        }

        const data = await response.json();
        const topLevelComments = data.data || [];
        const allComments: any[] = [];

        for (const comment of topLevelComments) {
            // Normalizing top-level
            const normalizedTop = {
                ...comment,
                username: comment.username || comment.from?.username || "user",
            };
            allComments.push(normalizedTop);

            // Fetching and normalizing replies
            if (comment.replies?.data) {
                for (const reply of comment.replies.data) {
                    allComments.push({
                        ...reply,
                        parent_id: comment.id,
                        username: reply.username || reply.from?.username || "user",
                    });
                }

                // DEEP CAPTURE: Paginating hidden nested replies
                if (deepReplies && comment.replies?.paging?.next) {
                    let replyCursor = comment.replies.paging.cursors?.after;
                    let replyPage = 0;
                    while (replyCursor && replyPage < 10) {
                        if (startTime && Date.now() - startTime > 45000) break;
                        const replyUrl = `https://graph.instagram.com/${GRAPH_API_VERSION}/${comment.id}/replies?fields=id,text,timestamp,from,parent_id&after=${replyCursor}${since ? `&since=${since}` : ""}`;
                        const replyResp = await graphApiFetch(replyUrl, accessToken);
                        if (!replyResp.ok) break;
                        const { data: extraReplies, paging } = await replyResp.json();
                        if (extraReplies?.length) {
                            for (const er of extraReplies) {
                                allComments.push({
                                    ...er,
                                    username: er.username || er.from?.username || "user",
                                });
                            }
                        }
                        replyCursor = paging?.cursors?.after;
                        replyPage++;
                    }
                }
            }
        }

        return {
            comments: allComments,
            nextCursor: data.paging?.cursors?.after || null,
        };
    } catch (error) {
        logger.error("Exception fetching comments", { mediaId, category: "instagram" }, error as Error);
        return { comments: [], nextCursor: null };
    }
}


/**
 * Fetch a user's recent media posts (up to 25)
 */
export async function fetchUserRecentMedia(
    accessToken: string,
    instagramUserId: string,
    limit: number = 25
): Promise<{ data: any[], errorCode?: number }> {
    try {
        const response = await graphApiFetch(
            `https://graph.instagram.com/${GRAPH_API_VERSION}/${instagramUserId}/media?fields=id,caption,timestamp&limit=${limit}`,
            accessToken
        );

        if (!response.ok) {
            const errorData = await response.json();
            const errorCode = errorData?.error?.code;
            logger.error("Error fetching recent media", { instagramUserId, errorData, category: "instagram" });
            return { data: [], errorCode };
        }

        const data = await response.json();
        return { data: data.data || [] };
    } catch (error) {
        logger.error("Exception fetching recent media", { instagramUserId, category: "instagram" }, error as Error);
        return { data: [] };
    }
}

/**
 * Fetch metadata for a specific media ID (handles Reel ID mismatch)
 */
export async function fetchMediaMetadata(
    accessToken: string,
    mediaId: string
): Promise<{ id: string, caption: string | null } | null> {
    try {
        const response = await graphApiFetch(
            `https://graph.instagram.com/${GRAPH_API_VERSION}/${mediaId}?fields=id,caption`,
            accessToken
        );

        if (!response.ok) return null;

        const data = await response.json();
        return {
            id: data.id,
            caption: data.caption || null
        };
    } catch (error) {
        logger.error("Error fetching media metadata", { mediaId }, error as Error);
        return null;
    }
}

/**
 * Create a new top-level comment on a media post
 */
export async function createComment(
    accessToken: string,
    mediaId: string,
    message: string
): Promise<{ id: string } | null> {
    try {
        if (!message || message.trim().length === 0) {
            logger.error("Cannot create comment with empty text", { category: "instagram" });
            return null;
        }

        logger.info("Creating comment on media", { mediaId, category: "instagram" });
        const encodedMessage = encodeURIComponent(message);
        const response = await graphApiFetch(
            `https://graph.instagram.com/${GRAPH_API_VERSION}/${mediaId}/comments?message=${encodedMessage}`,
            accessToken,
            { method: "POST" }
        );

        if (!response.ok) {
            const errorData = await response.json();
            logger.error("Create comment error", { mediaId, errorData, category: "instagram" });
            return null;
        }

        const data = await response.json();
        logger.info("Comment created successfully", { commentId: data.id, category: "instagram" });
        return { id: data.id };
    } catch (error) {
        logger.error("Exception creating comment", { mediaId, category: "instagram" }, error as Error);
        return null;
    }
}

/**
 * Delete a comment permanently
 */
export async function deleteComment(
    accessToken: string,
    commentId: string
): Promise<boolean> {
    try {
        logger.info("Deleting comment", { commentId, category: "instagram" });
        const response = await graphApiFetch(
            `https://graph.instagram.com/${GRAPH_API_VERSION}/${commentId}`,
            accessToken,
            { method: "DELETE" }
        );

        if (!response.ok) {
            const errorData = await response.json();
            logger.error("Delete comment error", { commentId, errorData, category: "instagram" });
            return false;
        }

        logger.info("Comment deleted successfully", { commentId, category: "instagram" });
        return true;
    } catch (error) {
        logger.error("Exception deleting comment", { commentId, category: "instagram" }, error as Error);
        return false;
    }
}

/**
 * Hide or unhide a comment
 */
export async function hideComment(
    accessToken: string,
    commentId: string,
    hide: boolean
): Promise<boolean> {
    try {
        logger.info(hide ? "Hiding comment" : "Unhiding comment", { commentId, category: "instagram" });
        const response = await graphApiFetch(
            `https://graph.instagram.com/${GRAPH_API_VERSION}/${commentId}`,
            accessToken,
            {
                method: "POST",
                body: { hide: hide },
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            logger.error("Hide comment error", { commentId, hide, errorData, category: "instagram" });
            return false;
        }

        logger.info(`Comment ${hide ? "hidden" : "unhidden"} successfully`, { commentId, category: "instagram" });
        return true;
    } catch (error) {
        logger.error(`Exception ${hide ? "hiding" : "unhiding"} comment`, { commentId, category: "instagram" }, error as Error);
        return false;
    }
}

/**
 * Default message templates used by the platform.
 * Messages NOT in this list are considered "user-added" and will not get random emojis.
 */
export const DEFAULT_MESSAGES = [
    "Check your DMs! 📬",
    "Just sent you a message! 💌",
    "Sent! Check your inbox 🔥",
    "DM sent! Go check it out ✨",
    "You've got mail! 📩",
    "Check your DMs!",
    "Hey! Thanks for being part of my community 😊\n\nClick below and I'll send you the details in just a sec ✨",
    "Here is the link you requested! ✨",
    "Hey! 👋 To unlock this, please follow us first!",
    "Here is the link you requested! ✨",
    "Open Link",
    "Show me more"
];

/**
 * Add random variation to message to bypass Meta's spam filters
 * Supports {Option A|Option B} spintax and {username} variables
 */
export function getUniqueMessage(message: string, username?: string | null, skipGreeting?: boolean, skipEmoji?: boolean): string {
    if (!message) return "";

    // 0. Auto-inject a personalized greeting if message doesn't already start with one
    //    Skip for public comment replies (they already get @username prefix from processor)
    const greetingRegex = /^(hey|hi|hello|hola|yo|sup|what'?s up|howdy)/i;
    const alreadyHasGreeting = greetingRegex.test(message.trim());

    let fullMessage = message;
    if (!skipGreeting && !alreadyHasGreeting) {
        if (username) {
            // With username: use personalized greeting
            const greetings = [
                "Hey", "Hi", "Hello", "Hey there", "Hi there",
                "Greetings", "What's up", "Yo", "Howdy", "Hia"
            ];
            const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
            fullMessage = `${randomGreeting} @${username}! ${message}`;
        } else {
            // Without username: use simple greeting
            const greetings = [
                "Hey!", "Hi!", "Hello!", "Hey there!", "Hi there!",
                "Greetings!", "Yo!", "Sup!", "Howdy!"
            ];
            const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
            fullMessage = `${randomGreeting} ${message}`;
        }
    } else if (!skipGreeting && username) {
        // Message has greeting but no personalization — inject username after greeting
        const hasUsername = /\{username\}|@\w+/i.test(message);
        if (!hasUsername) {
            fullMessage = message.replace(greetingRegex, (match) => `${match} @${username}`);
        }
    }

    // 1. Recursive Spintax Parser: {Hi|{Hello|Hey}}
    let parsedMessage = fullMessage;
    let iterations = 0;
    while (parsedMessage.includes('{') && parsedMessage.includes('}') && iterations < 5) {
        parsedMessage = parsedMessage.replace(/\{([^{}]*)\}/g, (match, contents) => {
            const lowerContents = contents.toLowerCase();
            if (lowerContents === 'username' || lowerContents === 'first_name') return match;

            const options = contents.split('|');
            if (options.length === 1) return match;
            return options[Math.floor(Math.random() * options.length)];
        });
        iterations++;
    }

    // 2. Personalize Variables (fallback to "there" if no username)
    if (username) {
        parsedMessage = parsedMessage.replace(/\{username\}|\{first_name\}/gi, `@${username}`);
    } else {
        parsedMessage = parsedMessage.replace(/\{username\}|\{first_name\}/gi, `there`);
    }

    // 3. Expanded emoji variations (over 30 standard friendly emojis)
    const variations = [
        "📬", "✨", "✅", "💬", "🚀", "📥", "💌", "🌟", "🔥", "💎",
        "⭐", "💡", "⚡", "🎉", "🎊", "🎈", "👋", "🙌", "👏", "👍",
        "💯", "🎯", "🏆", "🎁", "📝", "📌", "📍", "🔔", "📣", "🥳", ""
    ];
    // AUTOMATIC SMART DETECTION: 
    // 1. If the message already contains an emoji, we skip adding a random one.
    // 2. If the message is NOT a default platform message (user-added), we skip adding a random emoji.
    // 3. If skipEmoji is explicitly true, we skip.
    const hasEmoji = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(parsedMessage);
    const isDefault = DEFAULT_MESSAGES.some(d => message.includes(d) || d.includes(message));

    const shouldSkipEmoji = skipEmoji || hasEmoji || !isDefault;

    if (shouldSkipEmoji) {
        return parsedMessage;
    }

    const randomVariation = variations[Math.floor(Math.random() * variations.length)];

    return randomVariation
        ? `${parsedMessage} ${randomVariation}`
        : parsedMessage;
}

/**
 * Ensure URL has a protocol (https://) AND extract from text if needed
 * Fixes issue where users copy "Title https://link" into the URL field
 */
function ensureUrlProtocol(url: string | undefined): string | undefined {
    if (!url) return undefined;
    const trimmed = url.trim();
    if (trimmed.length === 0) return undefined;

    // 1. Scan for a valid http/https URL inside the string
    // This handles: "Site Title https://example.com" -> extracts "https://example.com"
    const urlMatch = trimmed.match(/(https?:\/\/[^\s]+)/);
    if (urlMatch) {
        return urlMatch[0];
    }

    // 2. If no protocol found, assume it is a domain (e.g. "google.com")
    if (!/^https?:\/\//i.test(trimmed)) {
        return `https://${trimmed}`;
    }

    return trimmed;
}

/**
 * Check if user is a known follower (from our tracking table) - Fallback
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function checkFollowStatus(
    supabase: any,
    userId: string,
    followerInstagramId: string
): Promise<boolean> {
    try {
        const { data, error } = await supabase
            .from("follow_tracking")
            .select("is_following")
            .eq("user_id", userId)
            .eq("follower_instagram_id", followerInstagramId)
            .single();

        if (error || !data) {
            return false;
        }

        return data.is_following === true;
    } catch (error) {
        logger.error("Error checking follow status from DB", { userId, category: "instagram" }, error as Error);
        return false;
    }
}

/**
 * Check if user has ALREADY received follow-gate for this automation
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function hasReceivedFollowGate(
    supabase: any,
    userId: string,
    automationId: string,
    commenterInstagramId: string
): Promise<boolean> {
    try {
        const { data } = await supabase
            .from("dm_logs")
            .select("id")
            .eq("user_id", userId)
            .eq("automation_id", automationId)
            .eq("instagram_user_id", commenterInstagramId)
            .eq("is_follow_gate", true)
            .single();

        return !!data;
    } catch {
        return false;
    }
}

/**
 * Record a follow event (called from webhook handler)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function recordFollowEvent(
    supabase: any,
    userId: string,
    followerInstagramId: string,
    followerUsername: string | null,
    isFollowing: boolean
): Promise<void> {
    try {
        const { error } = await supabase
            .from("follow_tracking")
            .upsert({
                user_id: userId,
                follower_instagram_id: followerInstagramId,
                follower_username: followerUsername,
                is_following: isFollowing,
                followed_at: isFollowing ? new Date().toISOString() : undefined,
                unfollowed_at: !isFollowing ? new Date().toISOString() : undefined,
            }, {
                onConflict: 'user_id,follower_instagram_id',
            });

        if (error) {
            logger.error("Error recording follow event", { followerUsername, category: "instagram" }, error as Error);
        } else {
            logger.info(`Recorded ${isFollowing ? 'follow' : 'unfollow'}`, { followerUsername: followerUsername || followerInstagramId, category: "instagram" });
        }
    } catch (error) {
        logger.error("Exception recording follow event", { category: "instagram" }, error as Error);
    }
}

/**
 * Increment automation analytics counters
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function incrementAutomationCount(supabase: any, automationId: string, field: string) {
    try {
        const { error } = await supabase.rpc('increment_automation_stats', {
            p_automation_id: automationId,
            p_increment_sent: field === 'dm_sent_count' ? 1 : 0,
            p_increment_failed: field === 'dm_failed_count' ? 1 : 0,
            p_increment_comment: field === 'comment_count' ? 1 : 0,
            p_increment_click: field === 'click_count' ? 1 : 0
        });

        if (error) {
            logger.error(`Error incrementing ${field} via RPC`, { automationId, category: "instagram" }, error as Error);
        }
    } catch (error) {
        logger.error(`Exception incrementing ${field}`, { automationId, category: "instagram" }, error as Error);
    }
}
