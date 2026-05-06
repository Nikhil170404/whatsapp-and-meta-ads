import { getSupabaseAdmin } from "./supabase/client";
import { getPlanLimits } from "./pricing";
import { logger } from "./logger";
import { getUsagePeriodStart } from "./usage";

/**
 * ROLLING WINDOW RATE LIMITER (ManyChat-Style)
 *
 * Strategy: Instead of fixed hourly buckets that reset at clock boundaries,
 * we count actual sends from dm_queue.sent_at in a SLIDING 60-minute window.
 *
 * META_RATE_LIMITS (Actual Meta Platform Limits):
 * - Send API (DMs): 100 calls/second (Per IG pro account) — virtually unlimited hourly
 * - Private Replies API (comments): 750 calls/HOUR (Per IG pro account)
 * - Platform Rate Limit (app token): 200 * DAU / rolling 1hr (Per app)
 *
 * Our Limits (plan-based):
 * - Pro: 450 DMs/hr, 450 comments/hr (rolling window)
 * - Starter: 300/hr
 * - Free: 180/hr
 * - Monthly quotas still enforced from rate_limits table
 *
 * How it works:
 * - Every minute, the cron checks: "How many DMs were sent in the past 60 minutes?"
 * - As old sends "expire" from the window, new slots open automatically
 * - No hard reset at clock boundaries — smooth continuous flow
 * - Per-minute throughput for Pro: 600/60 = ~10/min average, but can burst higher
 */

export interface RateLimitConfig {
    hourlyLimit: number;
    monthlyLimit: number;
    spreadDelay: boolean;
    type?: 'dm' | 'comment';
    dryRun?: boolean;
}

/**
 * Get effective hourly limit — FULL SPEED, no throttling
 * 
 * ManyChat doesn't do circadian/warm-up throttling.
 * Meta's own rate limiters handle abuse. We run at plan speed.
 */
export function getEffectiveHourlyLimit(baseLimit: number, _userCreatedAt?: string): number {
    // Full speed — no circadian multipliers, no warm-up ramp
    // Meta handles their own throttling via HTTP 429 / error codes
    return baseLimit;
}

export interface RateLimitResult {
    allowed: boolean;
    queuePosition?: number;
    estimatedSendTime?: Date;
    remaining: {
        hourly: number;
        monthly: number;
    };
    rollingCount?: number; // NEW: How many sent in last 60 min
}

/**
 * Smart Rate Limit Check (Rolling Window)
 * 
 * Uses get_rolling_dm_count / get_rolling_comment_count RPCs that count
 * actual dm_queue records with sent_at in the last 60 minutes.
 * 
 * NO increment/decrement pattern — pure read check.
 * The dm_queue.sent_at IS the counter.
 */
export async function smartRateLimit(
    userId: string,
    config: RateLimitConfig,
    userCreatedAt?: string
): Promise<RateLimitResult> {
    const supabase = getSupabaseAdmin();
    const now = new Date();

    const effectiveHourlyLimit = getEffectiveHourlyLimit(config.hourlyLimit, userCreatedAt);
    const type = config.type || 'dm';

    // 1. Monthly Check (Quota enforced for BOTH DMs and Comments)
    const monthStart = await getUsagePeriodStart(userId, supabase, config.type || 'free');

    // Authoritative monthly count: only confirmed sent DMs (reply_sent=true), excluding
    // button-click postback events. This matches what the dashboard displays so users
    // see the same number that triggers the block.
    const { count: dmLogsCount } = await (supabase as any)
        .from("dm_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_follow_gate", false)
        .eq("reply_sent", true)
        .not("comment_text", "like", "Button click%")
        .gte("created_at", monthStart.toISOString());

    const monthlyUsed = dmLogsCount || 0;
    const monthlyRemaining = Math.max(0, config.monthlyLimit - monthlyUsed);

    // Monthly quota check: block if confirmed sends have reached the limit.
    // Consistent for both DMs and comments since we now count only reply_sent=true.
    const isMonthlyLimitHit = monthlyUsed >= config.monthlyLimit;

    if (isMonthlyLimitHit) {
        logger.warn("Monthly limit hit", { userId, type, monthlyUsed, limit: config.monthlyLimit });
        // Add jitter (up to 4 hours) so we don't spam everything at the exact same second next month
        const jitterMs = Math.floor(Math.random() * 4 * 60 * 60 * 1000);
        const nextMonthBase = new Date(monthStart.getTime() + 32 * 24 * 60 * 60 * 1000);
        nextMonthBase.setUTCHours(0, 0, 0, 0);

        return {
            allowed: false,
            estimatedSendTime: new Date(nextMonthBase.getTime() + jitterMs),
            remaining: { hourly: 0, monthly: 0 },
            rollingCount: 0
        };
    }

    // 2. Rolling Window Check (60-minute sliding window from dm_queue)
    const rpcName = type === 'comment' ? 'get_rolling_comment_count' : 'get_rolling_dm_count';
    const { data: rollingCount, error: rollingError } = await (supabase as any)
        .rpc(rpcName, { p_user_id: userId });

    if (rollingError) {
        logger.error(`Rolling rate limit RPC failed (${rpcName})`, { userId, error: rollingError, category: "rate-limiter" });
        // Fail open — allow the send but log the error
        return {
            allowed: true,
            remaining: { hourly: effectiveHourlyLimit, monthly: monthlyRemaining },
            rollingCount: 0
        };
    }

    const currentRollingCount = (rollingCount as number) || 0;
    const hourlyRemaining = Math.max(0, effectiveHourlyLimit - currentRollingCount);

    // 3. Check if limit exceeded
    if (currentRollingCount >= effectiveHourlyLimit) {
        // Calculate when the oldest send in the window will expire
        // Estimate: slots free up at ~(limit/60) per minute
        const slotsPerMinute = Math.max(1, effectiveHourlyLimit / 60);
        const minutesUntilSlot = Math.ceil(1 / slotsPerMinute * 60); // ~1 minute typically
        const estimatedSendTime = new Date(now.getTime() + minutesUntilSlot * 1000);

        return {
            allowed: false,
            estimatedSendTime,
            remaining: { hourly: 0, monthly: monthlyRemaining },
            rollingCount: currentRollingCount
        };
    }

    // 4. Spread Delay (optional — for inline sends)
    if (config.spreadDelay && currentRollingCount > 1) {
        const delaySeconds = Math.floor((60 * 60) / effectiveHourlyLimit);
        const estimatedSendTime = new Date(now.getTime() + delaySeconds * 1000);

        return {
            allowed: true,
            queuePosition: currentRollingCount + 1,
            estimatedSendTime,
            remaining: { hourly: hourlyRemaining, monthly: monthlyRemaining },
            rollingCount: currentRollingCount
        };
    }

    return {
        allowed: true,
        remaining: { hourly: hourlyRemaining, monthly: monthlyRemaining },
        rollingCount: currentRollingCount
    };
}

/**
 * Helper to generate a non-uniform random delay (mimicking human memory/busy-ness)
 */
function getNonUniformDelay(): number {
    return Math.floor(Math.random() * 11) + 20; // 20-30s
}

/**
 * Queue a DM for later sending with a mandatory human-like delay
 */
export async function queueDM(
    userId: string,
    dmData: {
        commentId: string;
        commenterId: string;
        message: string;
        automation_id: string;
    },
    sendAt?: Date,
    priority: number = 5
) {
    const supabase = getSupabaseAdmin();

    let scheduledTime: Date;
    if (sendAt) {
        scheduledTime = sendAt;
    } else {
        const delaySeconds = getNonUniformDelay();
        scheduledTime = new Date(Date.now() + delaySeconds * 1000);

        // MICRO-STAGGERING: Check if there's already something queued for this lead
        try {
            const { data: existing } = await (supabase as any)
                .from("dm_queue")
                .select("scheduled_send_at")
                .eq("user_id", userId)
                .eq("instagram_comment_id", dmData.commentId)
                .eq("status", "pending")
                .order("scheduled_send_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (existing && (existing as any).scheduled_send_at) {
                const existingTime = new Date((existing as any).scheduled_send_at).getTime();
                if (Math.abs(existingTime - scheduledTime.getTime()) < 60000) {
                    const staggerDelay = Math.floor(Math.random() * 11) + 5;
                    scheduledTime = new Date(existingTime + staggerDelay * 1000);
                    logger.debug("[Anti-Ban] Micro-staggering applied to lead interaction", { userId, commentId: dmData.commentId });
                }
            }
        } catch (err) {
            logger.warn("Micro-staggering check failed, using default delay", { userId, commentId: dmData.commentId, error: err });
        }
    }

    const { error } = await (supabase as any).from("dm_queue").insert({
        user_id: userId,
        instagram_comment_id: dmData.commentId,
        instagram_user_id: dmData.commenterId,
        message: dmData.message,
        automation_id: dmData.automation_id,
        scheduled_send_at: scheduledTime.toISOString(),
        status: "pending",
        priority: priority,
    });

    if (error) {
        logger.error("Failed to queue DM", { category: "rate-limiter" }, error);
        throw error;
    }

    logger.info("DM queued with human-like safety delay", {
        scheduledFor: scheduledTime.toISOString(),
        category: "rate-limiter"
    });
}

/**
 * Record an inline send in dm_queue so the rolling window counter picks it up.
 * Called after a DM is sent directly (not via queue processing).
 */
export async function recordInlineSend(
    userId: string,
    dmData: {
        commentId: string;
        commenterId: string;
        message: string;
        automation_id: string;
    }
) {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    // Insert a "sent" record so rolling window count includes this inline send
    await (supabase as any).from("dm_queue").upsert({
        user_id: userId,
        instagram_comment_id: dmData.commentId,
        instagram_user_id: dmData.commenterId,
        message: dmData.message,
        automation_id: dmData.automation_id,
        scheduled_send_at: now,
        status: "sent",
        sent_at: now,
        priority: 10,
    }, { onConflict: 'id' });
}

/**
 * Process pending DMs in the queue — ROLLING WINDOW (ManyChat-Style)
 * 
 * Key differences from old version:
 * 1. Batch size: 600 (not 200)
 * 2. Rolling 60-min window check per user (not fixed hourly bucket)
 * 3. Excess items rescheduled to 1-2 MINUTES later (not next hour)
 * 4. No increment/decrement RPCs — dm_queue.sent_at IS the counter
 * 5. Still increments rate_limits table for monthly counting only
 */
import { sendInstagramDM, incrementAutomationCount, shouldThrottle } from "./instagram/service";
import { getConsistentRedis } from "./redis";

export async function processQueuedDMs() {
    const supabase = getSupabaseAdmin();
    const now = new Date();

    logger.info("Rolling Window Cron Processing Started", { category: "rate-limiter" });

    // RECOVERY: Reset stuck "processing" items older than 3 minutes
    const threeMinutesAgo = new Date(Date.now() - 3 * 60000);
    const { error: recoveryError } = await (supabase as any)
        .from("dm_queue")
        .update({ status: "pending" })
        .eq("status", "processing")
        .lt("scheduled_send_at", threeMinutesAgo.toISOString());

    if (recoveryError) {
        logger.error("Failed to recover stale processing DMs", { category: "rate-limiter" }, recoveryError);
    }

    // RECOVERY: Reset failed items with attempts < 3 that have waited at least 1 minute
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const { error: failedRecoveryError } = await (supabase as any)
        .from("dm_queue")
        .update({ status: "pending", scheduled_send_at: new Date().toISOString() })
        .eq("status", "failed")
        .lt("attempts", 3)
        .lt("updated_at", oneMinuteAgo.toISOString());

    if (failedRecoveryError) {
        logger.error("Failed to recover failed DMs", { category: "rate-limiter" }, failedRecoveryError);
    }

    // 1. Fetch Processable DMs — INCREASED BATCH SIZE TO 600
    const { data: candidates, error: candidateError } = await (supabase as any)
        .from("dm_queue")
        .select("id")
        .eq("status", "pending")
        .lte("scheduled_send_at", now.toISOString())
        .order("priority", { ascending: false })
        .order("scheduled_send_at", { ascending: true })
        .limit(600); // ManyChat-style: fetch full hour's worth

    if (!candidates || candidates.length === 0) {
        logger.debug("No DMs ready for delivery", { category: "rate-limiter" });
        return;
    }

    // ATOMIC LOCK
    const idsToLock = candidates.map((c: any) => c.id);
    const { data: queuedDMs, error } = await (supabase as any)
        .from("dm_queue")
        .update({ status: "processing", scheduled_send_at: now.toISOString() })
        .eq("status", "pending")
        .in("id", idsToLock)
        .select(`
      *,
      users (id, plan_type, instagram_access_token, instagram_user_id, created_at, email),
      automations (button_text, link_url, media_thumbnail_url, followup_enabled, followup_message)
    `);

    if (error) {
        logger.error("Error securing atomic lock on queue", { category: "rate-limiter" }, error);
        return;
    }

    if (!queuedDMs || queuedDMs.length === 0) {
        logger.info("Cron: Another process already claimed the queue batch", { category: "rate-limiter" });
        return;
    }

    logger.info("Processing queued DMs (Rolling Window)", { count: queuedDMs.length, category: "rate-limiter" });

    // 2. Group DMs by User
    const userGroups: { [key: string]: typeof queuedDMs } = {};
    queuedDMs.forEach((dm: any) => {
        if (!userGroups[dm.user_id]) userGroups[dm.user_id] = [];
        userGroups[dm.user_id].push(dm);
    });

    // 3. Process Each User Group with Rolling Window
    const userPromises = Object.keys(userGroups).map(async (userId) => {
        const userDMs = userGroups[userId];
        const user = userDMs[0].users;

        // PRE-CHECK: Skip if Meta has throttled this account
        const throttleCheck = await shouldThrottle(user.instagram_user_id);
        if (throttleCheck.throttled) {
            const resumeTime = new Date(Date.now() + throttleCheck.delayMs);
            logger.warn("Account throttled by Meta — rescheduling batch", {
                userId, resumeAt: resumeTime.toISOString(), delayMs: throttleCheck.delayMs, category: "rate-limiter"
            });
            await rescheduleItems(supabase, userDMs.map((d: any) => d.id), resumeTime, 5);
            return;
        }

        // A. Get Plan Limits
        const planType = user.plan_type || "free";
        const limits = getPlanLimits(planType);

        // B. ROLLING WINDOW: Get current 60-min counts
        const { data: rollingDMCount } = await (supabase as any)
            .rpc("get_rolling_dm_count", { p_user_id: userId });
        const { data: rollingCommentCount } = await (supabase as any)
            .rpc("get_rolling_comment_count", { p_user_id: userId });

        const hourlyDMUsed = (rollingDMCount as number) || 0;
        const hourlyCommentUsed = (rollingCommentCount as number) || 0;

        // Monthly check — based on user's billing cycle!
        const monthStart = await getUsagePeriodStart(userId, supabase, planType);

        const { count: dmLogsMonthlyCount } = await (supabase as any)
            .from("dm_logs")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("is_follow_gate", false)
            .eq("reply_sent", true)
            .not("comment_text", "like", "Button click%")
            .gte("created_at", monthStart.toISOString());

        const monthlyUsed = dmLogsMonthlyCount || 0;

        const hourlyDMLimit = limits.dmsPerHour;
        const monthlyDMLimit = limits.dmsPerMonth;
        const hourlyCommentLimit = limits.commentsPerHour;

        // C. Split DMs vs Comment Replies
        const allDMs = userDMs.filter((dm: any) => !dm.message.startsWith("__PUBLIC_REPLY__:"));
        const allReplies = userDMs.filter((dm: any) => dm.message.startsWith("__PUBLIC_REPLY__:"));

        // monthlyUsed counts only reply_sent=true, so pending placeholders from the current
        // batch are not included — no adjustment needed.
        const availableMonthlySlots = Math.max(0, monthlyDMLimit - monthlyUsed);

        const dmSlots = Math.min(
            Math.max(0, hourlyDMLimit - hourlyDMUsed),
            availableMonthlySlots
        );
        const commentSlots = Math.min(
            Math.max(0, hourlyCommentLimit - hourlyCommentUsed),
            availableMonthlySlots
        );

        // E. Split into "send now" and "reschedule"
        const dmsToSend = allDMs.slice(0, dmSlots);
        const repliesToSend = allReplies.slice(0, commentSlots);

        // Items beyond the available monthly slots should be rescheduled to next month
        const monthlyLimitHit = availableMonthlySlots <= 0;
        const dmsToReschedule = allDMs.slice(dmSlots);
        const repliesToReschedule = allReplies.slice(commentSlots);

        // F. RESCHEDULE — 1-2 MINUTES later (not next hour!)
        // Pre-compute next-month start so both DM and reply blocks can reuse it.
        const nextMonthStart = new Date(monthStart);
        nextMonthStart.setUTCMonth(nextMonthStart.getUTCMonth() + 1);

        if (dmsToReschedule.length > 0) {
            if (availableMonthlySlots <= 0 || (monthlyDMLimit - monthlyUsed + dmsToSend.length <= 0)) {
                // Monthly limit hit for these items
                // Monthly limit hit — reschedule to next month
                logger.warn("User hit MONTHLY DM limit", { userId, count: dmsToReschedule.length, category: "rate-limiter" });

                // Send automated notification if first time hitting limit this month
                if (user.email && (planType === 'free' || planType === 'trial')) {
                    try {
                        const redis = getConsistentRedis(userId);
                        const now = new Date();
                        const cacheKey = `quota_email_sent:${userId}:${now.getUTCFullYear()}:${now.getUTCMonth()}`;

                        const alreadySent = redis ? await redis.get(cacheKey) : false;
                        if (!alreadySent) {
                            const { sendQuotaReachedEmail } = await import("./notifications/email");
                            await sendQuotaReachedEmail(user.email);
                            if (redis) await redis.set(cacheKey, "true", { ex: 32 * 24 * 60 * 60 });
                            logger.info("Auto-sent quota reached email", { userId, email: user.email });
                        }
                    } catch (err) {
                        logger.error("Failed to send automated quota email", { userId, error: err });
                    }
                }

                await rescheduleItems(supabase, dmsToReschedule.map((d: any) => d.id), nextMonthStart, limits.priorityQueue ? 10 : 5);
            } else {
                // ROLLING: Reschedule to 1-2 minutes from now (slots will free up)
                const nextSlotTime = new Date(Date.now() + 60 * 1000); // 1 minute
                logger.info("Rolling reschedule: DMs deferred by 1-2 min (slots will free up)", {
                    userId, count: dmsToReschedule.length, rollingUsed: hourlyDMUsed, limit: hourlyDMLimit, category: "rate-limiter"
                });
                await rescheduleItems(supabase, dmsToReschedule.map((d: any) => d.id), nextSlotTime, limits.priorityQueue ? 10 : 5);
            }
        }

        if (repliesToReschedule.length > 0) {
            if (availableMonthlySlots <= 0) {
                // Monthly quota exhausted — push comment replies to next month, not 1 min loop
                logger.warn("User hit MONTHLY limit — rescheduling comment replies to next month", {
                    userId, count: repliesToReschedule.length, category: "rate-limiter"
                });
                await rescheduleItems(supabase, repliesToReschedule.map((d: any) => d.id), nextMonthStart, limits.priorityQueue ? 10 : 5);
            } else {
                const nextSlotTime = new Date(Date.now() + 60 * 1000); // 1 minute
                logger.info("Rolling reschedule: Comments deferred by 1-2 min", {
                    userId, count: repliesToReschedule.length, rollingUsed: hourlyCommentUsed, limit: hourlyCommentLimit, category: "rate-limiter"
                });
                await rescheduleItems(supabase, repliesToReschedule.map((d: any) => d.id), nextSlotTime, limits.priorityQueue ? 10 : 5);
            }
        }

        const toSend = [...dmsToSend, ...repliesToSend];

        // G. Send Allowed Actions
        if (toSend.length > 0) {
            logger.info("Sending queued actions (Rolling Window)", {
                userId, count: toSend.length, dmSlots, commentSlots, planType, category: "rate-limiter"
            });

            // Sequential staggered delivery (200ms gap to avoid Meta concurrency blocks)
            for (let i = 0; i < toSend.length; i++) {
                const dm = toSend[i];

                // Anti-Ban: 1-3s random stagger between queued messages
                if (i > 0) {
                    const staggerDelay = Math.floor(Math.random() * 2000) + 1000;
                    await new Promise(resolve => setTimeout(resolve, staggerDelay));
                }

                try {
                    const isPublicReply = dm.message.startsWith("__PUBLIC_REPLY__:");
                    const isStep1Only = dm.message.startsWith("__STEP1__:");
                    const actualMessage = isPublicReply
                        ? dm.message.replace("__PUBLIC_REPLY__:", "")
                        : isStep1Only
                            ? dm.message.replace("__STEP1__:", "")
                            : dm.message;
                    let actionSent = false;

                    if (isPublicReply) {
                        const { replyToComment } = await import("./instagram/service");
                        actionSent = await replyToComment(
                            dm.users.instagram_access_token,
                            dm.instagram_comment_id,
                            actualMessage,
                            supabase,
                            dm.user_id,
                            dm.automation_id
                        );
                    } else {
                        // STEP 1: Greeting + Postback Button (NEVER send link_url in Step 1)
                        // The link is delivered in Step 2 after the user clicks the button
                        // This matches the inline send behavior: finalLinkUrlToSend = undefined
                        actionSent = await sendInstagramDM(
                            dm.users.instagram_access_token,
                            dm.users.instagram_user_id,
                            dm.instagram_comment_id,
                            dm.instagram_user_id,
                            actualMessage,
                            dm.automation_id,
                            dm.automations.button_text,
                            undefined, // ALWAYS undefined — link delivered via postback click (Step 2)
                            undefined, // No thumbnail for greeting
                            supabase,
                            dm.user_id
                        );
                    }

                    if (actionSent) {
                        // Record for monthly counting (rate_limits table — keeps existing analytics working)
                        if (isPublicReply) {
                            await (supabase as any).rpc("increment_comment_rate_limit", { p_user_id: dm.user_id });
                            await incrementAutomationCount(supabase, dm.automation_id, "comment_count");
                        } else {
                            await (supabase as any).rpc("increment_rate_limit", { p_user_id: dm.user_id });
                            await incrementAutomationCount(supabase, dm.automation_id, "dm_sent_count");

                            await (supabase as any).from("dm_logs").update({
                                reply_sent: true,
                                reply_sent_at: new Date().toISOString(),
                            }).eq("instagram_comment_id", dm.instagram_comment_id);

                            // Schedule follow-up DM if automation has it enabled
                            await scheduleFollowupIfEnabled(supabase, dm);
                        }

                        // Mark as sent with sent_at (this is what the rolling window counts)
                        await (supabase as any).from("dm_queue").update({
                            status: "sent",
                            sent_at: new Date().toISOString()
                        }).eq("id", dm.id);
                    } else {
                        throw new Error("Action delivery failed");
                    }
                } catch (error) {
                    const errMsg = (error as Error).message;
                    const currentAttempts = dm.attempts || 0;
                    // Check BOTH the thrown error AND any prior error_message stored on the queue item
                    const priorError = dm.error_message || "";
                    const combinedError = `${errMsg} ${priorError}`;

                    // PERMANENT FAILURES: Meta errors that will NEVER succeed on retry.
                    // These waste queue slots and should be failed immediately.
                    const isPermanentFailure =
                        combinedError.includes("comment is too old") ||
                        combinedError.includes("too old") ||
                        combinedError.includes("already has a reply") ||       // Comment already replied to
                        combinedError.includes("cannot be found") ||            // User deleted/private/blocked (Error 100)
                        combinedError.includes("granular scopes") ||
                        combinedError.includes("comment id is valid") ||
                        combinedError.includes("does not exist") ||             // User/comment deleted
                        combinedError.includes("Cannot message users") ||       // Messaging not available
                        combinedError.includes("Application does not have");    // Missing permissions

                    if (!isPermanentFailure && currentAttempts < 2) {
                        const postFailThrottle = await shouldThrottle(dm.users.instagram_user_id);
                        let retryTime: Date;

                        if (postFailThrottle.throttled && postFailThrottle.delayMs > 60000) {
                            retryTime = new Date(Date.now() + postFailThrottle.delayMs);
                        } else {
                            const backoffMs = currentAttempts === 0 ? 60000 : 3 * 60000;
                            retryTime = new Date(Date.now() + backoffMs);
                        }

                        await (supabase as any).from("dm_queue").update({
                            status: "pending",
                            scheduled_send_at: retryTime.toISOString(),
                            attempts: currentAttempts + 1,
                            error_message: errMsg.substring(0, 500)
                        }).eq("id", dm.id);

                        logger.info("DM requeued for retry", { dmId: dm.id, retryCount: currentAttempts + 1, category: "rate-limiter" });
                    } else {
                        await (supabase as any).from("dm_queue").update({
                            status: "failed",
                            attempts: currentAttempts + 1,
                            error_message: errMsg.substring(0, 500)
                        }).eq("id", dm.id);

                        if (!dm.message.startsWith("__PUBLIC_REPLY__:")) {
                            await incrementAutomationCount(supabase, dm.automation_id, "dm_failed_count");
                            await (supabase as any).from("dm_logs").update({
                                reply_sent: false,
                                error_message: errMsg.substring(0, 500)
                            }).eq("instagram_comment_id", dm.instagram_comment_id);
                        }
                    }
                    logger.error("Queued action delivery failed", {
                        dmId: dm.id,
                        reason: errMsg,
                        category: "rate-limiter"
                    });
                }
            }
        }
    });

    await Promise.allSettled(userPromises);
    logger.info("Queue Processing Complete (Rolling Window)", { category: "rate-limiter" });
}

/**
 * After an initial DM is sent, queue a follow-up DM 24h later if the automation has it enabled.
 * Idempotent — checks for an existing pending/sent follow-up before inserting.
 */
export async function scheduleFollowupIfEnabled(supabase: any, dm: any) {
    const automation = dm.automations;
    if (!automation?.followup_enabled || !automation?.followup_message) return;

    // Dedup: skip if a follow-up is already queued or sent for this recipient+automation
    const { data: existing } = await supabase
        .from("dm_followups")
        .select("id")
        .eq("instagram_user_id", dm.instagram_user_id)
        .eq("automation_id", dm.automation_id)
        .in("status", ["scheduled", "processing", "sent"])
        .maybeSingle();

    if (existing) return;

    const { getUniqueMessage } = await import("./instagram/service");
    const followupMsg = getUniqueMessage(automation.followup_message, undefined, true);

    const sendAt = new Date(Date.now() + 23 * 60 * 60 * 1000); // 23h for safety (stay inside Meta window)

    const { error } = await supabase.from("dm_followups").insert({
        user_id: dm.user_id,
        instagram_user_id: dm.instagram_user_id,
        message: followupMsg,
        automation_id: dm.automation_id,
        scheduled_send_at: sendAt.toISOString(),
        status: "scheduled",
        initial_dm_id: dm.id,
    });

    if (error) {
        logger.error("Failed to schedule follow-up DM", { userId: dm.user_id, automationId: dm.automation_id, category: "rate-limiter" }, error);
    } else {
        logger.info("Follow-up DM scheduled (dm_followups)", {
            userId: dm.user_id,
            scheduledFor: sendAt.toISOString(),
            category: "rate-limiter"
        });
    }
}



/**
 * Reschedule items — MICRO WINDOWS (1-3 minutes, not next hour)
 * 
 * Spreads items across a short window so the next cron run picks them up
 */
async function rescheduleItems(supabase: any, ids: string[], nextTime: Date, priority: number) {
    if (ids.length === 0) return;

    // Spread items across 2 minutes after baseTime (rolling window frees slots continuously)
    const spreadWindowMs = 2 * 60 * 1000; // 2 minutes
    const gapMs = ids.length > 1 ? Math.floor(spreadWindowMs / ids.length) : 0;

    await Promise.all(ids.map((id, index) => {
        const jitter = Math.floor(Math.random() * 5000); // ±5s per item
        const staggeredTime = new Date(nextTime.getTime() + index * gapMs + jitter);

        return (supabase as any)
            .from("dm_queue")
            .update({
                status: "pending",
                scheduled_send_at: staggeredTime.toISOString(),
                priority: priority
            })
            .eq("id", id);
    }));

    logger.info("Rolling reschedule complete", { count: ids.length, baseTime: nextTime.toISOString(), category: "rate-limiter" });
}
