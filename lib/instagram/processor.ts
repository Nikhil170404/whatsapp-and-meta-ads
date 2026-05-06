import { getSupabaseAdmin } from "@/lib/supabase/client";
import {
    sendInstagramDM,
    replyToComment,
    checkFollowStatus,
    checkIsFollowing,
    getUniqueMessage,
    incrementAutomationCount,
    sendFollowGateCard,
    hasReceivedFollowGate,
    getMediaDetails
} from "@/lib/instagram/service";
import { smartRateLimit, queueDM, recordInlineSend, scheduleFollowupIfEnabled } from "@/lib/smart-rate-limiter";
import {
    getCachedUser,
    setCachedUser,
    getCachedAutomation,
    setCachedAutomation,
    checkFrequencyCap,
    setFrequencyCap
} from "@/lib/cache";
import { getPlanLimits } from "@/lib/pricing";
import { logger } from "@/lib/logger";

/**
 * FAN ENGINE: Check if a fan just crossed a reward milestone and return a congratulatory message
 */
function checkFanMilestoneAndGetMessage(
    creatorId: string,
    fanIgId: string,
    oldPoints: number,
    newPoints: number,
    fanRewards: Array<{ points: number; title: string; link: string }> | undefined
): string {
    if (!fanRewards || fanRewards.length === 0 || oldPoints >= newPoints) return "";

    // Ensure rewards are sorted by points before checking milestones
    const sortedRewards = [...fanRewards].sort((a, b) => a.points - b.points);

    // Find rewards that were just crossed: old < threshold <= new
    const justUnlocked = sortedRewards.filter(r => oldPoints < r.points && newPoints >= r.points);
    if (justUnlocked.length === 0) return "";

    // Build the reward page URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.replykaro.com";
    const rewardPageUrl = `${baseUrl}/rewards/${creatorId}/${fanIgId}`;

    // Build congrats message with all unlocked rewards
    const rewardNames = justUnlocked.map(r => r.title).join(", ");
    const message = justUnlocked.length === 1
        ? `🎉 FAN MODE UNLOCKED: You earned ${newPoints} points & unlocked: "${rewardNames}"!`
        : `🎉 FAN MODE UNLOCKED: You hit ${newPoints} points & unlocked ${justUnlocked.length} rewards: ${rewardNames}!`;

    return `\n\n${message}\nTap "My Fan Points" below to claim! 🏆`;
}

/**
 * Handle a comment event from the batch
 */
export async function handleCommentEvent(instagramUserId: string, eventData: any, supabase: any, webhookCreatedAt?: string) {
    try {
        const { id: commentId, text: commentText, from, media, parent_id } = eventData;
        const commenterId = from?.id;
        const commenterUsername = from?.username;
        const mediaId = media?.id;

        if (!mediaId || !commenterId) {
            logger.warn("Missing mediaId or commenterId in comment event, dropping", { mediaId, commenterId, category: "instagram" });
            return;
        }

        // 1. IGNORE REPLIES (Prevent Loops) - Handled after automation lookup to respect respond_to_replies config

        // 1b. ENFORCE 24-HOUR WINDOW (Meta Policy)
        const eventTime = webhookCreatedAt ? new Date(webhookCreatedAt).getTime() : Date.now();
        const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

        // Add a 5-minute buffer for processing delays to be perfectly safe
        if (eventTime < (twentyFourHoursAgo + 5 * 60 * 1000)) {
            logger.warn("Skipping comment older than 24 hours", { instagramUserId, commenterId, eventTime: new Date(eventTime).toISOString() });
            return;
        }

        // 2. Find the user (with caching)
        let user = await getCachedUser(instagramUserId);

        // If user not in cache OR user in cache is missing critical username (needed for follow-gate)
        if (!user || !user.instagram_username || !user.fan_rewards) {
            const { data: dbUser } = await supabase
                .from("users")
                .select("id, instagram_access_token, instagram_user_id, instagram_username, plan_type, created_at, fan_rewards, fan_mode_enabled, plan_expires_at")
                .eq("instagram_user_id", instagramUserId)
                .single();

            if (!dbUser) {
                logger.warn("User not found in database for comment event", { instagramUserId, category: "instagram" });
                return;
            }
            user = dbUser;
            // Update cache with fresh data including username
            await setCachedUser(instagramUserId, dbUser);
        }

        // P1 Audit Fix: Enforce Plan Expiry (Cache Override)
        if (user && user.plan_type !== 'free' && user.plan_expires_at) {
            if (new Date(user.plan_expires_at).getTime() < Date.now()) {
                user.plan_type = 'free';
            }
        }

        // SaaS Optimization: Persistent Comment Tracking
        // Capture EVERY comment/reply the webhook sees so the Admin Dashboard is 100% accurate in real-time.
        if (!user) return;
        try {
            await (supabase as any).from("comments").upsert([{
                id: commentId,
                user_id: user.id,
                media_id: mediaId,
                instagram_user_id: commenterId,
                username: commenterUsername || "user",
                text: commentText,
                timestamp: eventData.timestamp || new Date().toISOString(),
                parent_id: parent_id || null,
                is_processed: false // Will be updated if DM is sent
            }], { onConflict: 'id' });
        } catch (e) {
            logger.warn("Failed to persist webhook comment to SQL", { commentId });
        }

        // 3. Self-comment detection
        if (!user || commenterId === user.instagram_user_id) {
            if (user) logger.info("Skipping self-comment processing", { instagramUserId });
            return;
        }

        // 4. Idempotency Check
        const { data: existingLog } = await supabase
            .from("dm_logs")
            .select("id")
            .eq("instagram_comment_id", commentId)
            .single();

        if (existingLog) {
            logger.info("Skipping duplicate comment ID", { commentId });
            return;
        }



        // 5. Find automation (with caching) - FAST SINGLE QUERY with Global Fallback
        const automationCacheKey = `automation:${user.id}:${mediaId}`;
        let automation = await getCachedAutomation(automationCacheKey);

        if (!automation) {
            // Single optimized query: Get ALL active automations for user, then pick best match
            const { data: allAutomations } = await supabase
                .from("automations")
                .select("*")
                .eq("user_id", user.id)
                .eq("is_active", true);

            if (!allAutomations || allAutomations.length === 0) {
                logger.info("User has no active automations", { userId: user.id });
                return;
            }

            // Priority 1: Exact media_id match
            let matchedAutomation = allAutomations.find((a: any) => a.media_id === mediaId);

            // Priority 2: Global fallback (Any Post / Next Post)
            if (!matchedAutomation) {
                // Try Any Post first (respecting keywords)
                matchedAutomation = allAutomations.find((a: any) =>
                    a.trigger_type === 'all_posts' &&
                    (!a.trigger_keyword || a.trigger_keyword.toLowerCase() === 'any' || 
                     checkKeywordMatch(a.trigger_type, a.trigger_keyword, commentText))
                );

                // Then try Next Post (respecting keywords)
                if (!matchedAutomation) {
                    matchedAutomation = allAutomations.find((a: any) =>
                        (a.trigger_type === 'next_posts' || a.media_id === 'NEXT_MEDIA') &&
                        (!a.trigger_keyword || a.trigger_keyword.toLowerCase() === 'any' || 
                         checkKeywordMatch(a.trigger_type, a.trigger_keyword, commentText))
                    );
                }

                if (matchedAutomation) {
                    logger.info("Using global fallback automation", {
                        automationId: matchedAutomation.id,
                        type: matchedAutomation.trigger_type
                    });
                }
            }

            if (!matchedAutomation) {
                logger.info("No matching automation for media", { mediaId, activeIds: allAutomations.map((a: any) => a.media_id) });
                return;
            }

            automation = matchedAutomation;
            await setCachedAutomation(automationCacheKey, matchedAutomation);
        }

        // Guard against null automation (TypeScript strict)
        if (!automation) {
            logger.info("No automation found after cache/db lookup", { userId: user.id, mediaId });
            return;
        }

        // Check respond_to_replies config for reply comments
        if (parent_id && !automation.respond_to_replies) {
            logger.info("Ignoring comment reply (respond_to_replies disabled)", {
                commentId, parent_id, automationId: automation.id
            });
            return;
        }

        // 5b. Timestamp Check + LOCK for 'Next Post'
        // "Next Post" means ONLY the very first post after the automation was created.
        // Once matched, we permanently lock the automation to that specific media_id.
        if (automation.trigger_type === 'next_posts' || automation.media_id === 'NEXT_MEDIA') {
            const mediaDetails = (await getMediaDetails(user.instagram_access_token, mediaId)) as any;
            if (!mediaDetails) {
                logger.warn("Could not fetch media details for Next Post validation", { mediaId });
                return;
            }

            const mediaTime = new Date(mediaDetails.timestamp).getTime();
            const automationTime = new Date(automation.created_at).getTime();

            // Guard: Only bind to media created AFTER the automation (with 1s safety buffer)
            if (mediaTime < automationTime - 1000) {
                logger.info("Skipping 'Next Post' trigger: Media created before automation", {
                    mediaId,
                    mediaTime: new Date(mediaTime).toISOString(),
                    automationTime: new Date(automationTime).toISOString()
                });
                return;
            }

            logger.info("NEXT_MEDIA lock: Binding automation to first detected post", {
                automationId: automation.id,
                mediaId,
                mediaTime: new Date(mediaTime).toISOString()
            });

            // Determine final trigger type based on keyword existence
            const finalTriggerType = automation.trigger_keyword ? "keyword" : "any";
            const thumbnail = mediaDetails.thumbnail_url || mediaDetails.media_url || null;

            await supabase
                .from("automations")
                .update({
                    media_id: mediaId,
                    trigger_type: finalTriggerType,
                    media_caption: mediaDetails.caption ? mediaDetails.caption.substring(0, 100) : (mediaDetails.media_type === "VIDEO" ? "🎬 Locked Reel" : "📸 Locked Post"),
                    media_url: mediaDetails.media_url || null,
                    media_thumbnail_url: thumbnail,
                })
                .eq("id", automation.id);

            // 5. Update local reference and CACHE with new state (Fix for "Waiting" loop)
            automation.media_id = mediaId;
            automation.trigger_type = finalTriggerType;
            automation.media_thumbnail_url = thumbnail;
            automation.media_url = mediaDetails.media_url || null;

            const { setCachedAutomation, clearAutomationCache } = await import("@/lib/cache");

            // Set cache for the new specific media ID
            await setCachedAutomation(`automation:${user.id}:${mediaId}`, automation);

            // Clear the old NEXT_MEDIA cache entry so it's no longer "Waiting"
            await clearAutomationCache(`automation:${user.id}:NEXT_MEDIA`);
        }

        // 6. Check keyword match
        if (!checkKeywordMatch(automation.trigger_type, automation.trigger_keyword ?? null, commentText)) {
            logger.info("Keyword mismatch", { commentText, triggerKeyword: automation.trigger_keyword || "any" });
            return;
        }

        // SaaS Optimization: Use Redis for 24h Frequency Cap (Ultra Fast)
        const isCapped = await checkFrequencyCap(user.id, commenterId, automation.id);
        if (isCapped) {
            logger.info("Frequency cap hit (Redis): User already received THIS automation DM in the last 24h", { commenterUsername, automation_id: automation.id });
            return;
        }

        // 7. QUEUE PUBLIC REPLY (Safety First - Human Delay)
        // PUBLIC REPLY — Uses Meta's Private Replies API (separate pool from DMs).
        // Meta limit: 750 calls/HOUR per IG account. Our internal cap: 180-195/hr.
        // If over our hourly cap, push to queue (processed by cron every minute).
        const rawTemplates = automation.comment_reply_templates;
        let templates: string[] = [];
        if (typeof rawTemplates === 'string') {
            try { templates = JSON.parse(rawTemplates); } catch (e) { }
        } else if (Array.isArray(rawTemplates)) {
            templates = rawTemplates;
        }

        const singleReply = automation.comment_reply;
        let selectedReply = "";

        if (templates.length > 0) {
            const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
            selectedReply = getUniqueMessage(randomTemplate, commenterUsername, true);
        } else if (singleReply && singleReply.trim().length > 0) {
            selectedReply = getUniqueMessage(singleReply, commenterUsername, true);
        }

        if (selectedReply) {
            // Prepend @mention to make reply personal and avoid spam detection
            selectedReply = `@${commenterUsername} ${selectedReply}`;

            // Check Rate Limit for Public Reply (Rolling Window)
            const limits = getPlanLimits(user.plan_type || "free");
            const rateLimit = await smartRateLimit(
                user.id,
                {
                    hourlyLimit: limits.commentsPerHour,
                    monthlyLimit: limits.dmsPerMonth,
                    spreadDelay: false,
                    type: 'comment',
                },
                user.created_at
            );

            if (rateLimit.allowed) {
                // Anti-Ban: 10-30s random delay
                const replyDelay = Math.floor(Math.random() * 20000) + 10000;
                logger.info(`[Anti-Ban] Delaying public comment reply ${Math.round(replyDelay / 1000)}s`, { commenterUsername, automationId: automation.id });
                await new Promise(r => setTimeout(r, replyDelay));

                const replySent = await replyToComment(
                    user.instagram_access_token,
                    commentId,
                    selectedReply,
                    supabase,
                    user.id,
                    automation.id
                );

                if (replySent) {
                    await incrementAutomationCount(supabase, automation.id, "comment_count");
                    // Record in dm_queue so rolling window counter includes this inline send
                    await recordInlineSend(user.id, {
                        commentId, commenterId, message: `__PUBLIC_REPLY__:${selectedReply}`, automation_id: automation.id
                    });
                    // Monthly counter (rate_limits table)
                    await (supabase as any).rpc("increment_comment_rate_limit", { p_user_id: user.id });
                    logger.info("Public reply sent instantly", { commenterUsername, automationId: automation.id });
                } else {
                    logger.warn("Public reply API failed", { commenterUsername });
                }
            } else {
                logger.warn("Public reply rate limited, pushing to queue", { userId: user.id });
                await queueDM(user.id, {
                    commentId: commentId,
                    commenterId: commenterId,
                    message: `__PUBLIC_REPLY__:${selectedReply}`,
                    automation_id: automation.id
                }, rateLimit.estimatedSendTime);
            }
        }

        // 8. ONE DM PER USER CHECK + ATOMIC CLAIM
        // Use atomic insert to prevent race conditions when multiple comments arrive simultaneously
        // First do a fast check, then insert a placeholder to claim the slot atomically
        const { data: userAlreadyDmed } = await supabase
            .from("dm_logs")
            .select("id")
            .eq("instagram_user_id", commenterId)
            .eq("automation_id", automation.id)
            .eq("user_id", user.id)
            .eq("is_follow_gate", false)
            .maybeSingle();

        if (userAlreadyDmed) {
            logger.info("Skipping: User already DMed for this automation", { commenterUsername, automationId: automation.id });
            return;
        }

        // 8b. ATOMIC CLAIM - Insert placeholder to prevent race conditions
        // Uses unique index idx_dm_logs_unique_user_automation to prevent duplicates
        const placeholderRecord = {
            user_id: user.id,
            automation_id: automation.id,
            instagram_comment_id: commentId,
            instagram_user_id: commenterId,
            instagram_username: commenterUsername,
            keyword_matched: automation.trigger_keyword || "ANY",
            comment_text: commentText,
            reply_sent: false,
            is_follow_gate: false,
        };

        const { error: claimError } = await supabase
            .from("dm_logs")
            .insert(placeholderRecord);

        if (claimError) {
            // Unique constraint violation (code 23505) means another request already claimed this
            if (claimError.code === '23505') {
                logger.info("Race condition prevented: Another request already processing", { commenterUsername });
                return;
            }
            // Log other errors but continue (non-critical)
            logger.error("Claim insert warning", { commenterUsername }, new Error(claimError.message));
        }

        // 9. QUEUE THE DM (Safety First - Human Delay)
        // Instead of sending instantly, we ALWAYS queue the initial greeting/DM.
        // This ensures every lead gets a random delay, which is safer than ManyChat.

        let dmMessage = getUniqueMessage(automation.reply_message, commenterUsername);

        // FAN ENGINE: Track comment interaction early so we can combine the milestone message
        if (automation.fan_mode || user.fan_mode_enabled) {
            try {
                const { data: fanResult } = await (supabase as any).rpc("upsert_fan", {
                    p_creator_id: user.id,
                    p_ig_user_id: commenterId,
                    p_ig_username: commenterUsername || null,
                    p_points: 2,
                    p_action: "comment",
                });
                if (fanResult?.[0]) {
                    const fanMsg = checkFanMilestoneAndGetMessage(
                        user.id, commenterId,
                        fanResult[0].out_old_points ?? 0, fanResult[0].out_points ?? 0,
                        user.fan_rewards
                    );
                    dmMessage += fanMsg;
                }
            } catch (e) { logger.warn("Fan tracking failed (comment)", { error: e }); }
        }

        let buttonText = automation.button_text || "Get Link";
        let directLink = automation.link_url || undefined;
        // The Opening DM ALWAYS uses a postback button.
        // We never send the direct link in step 1, matching the wizard flow explicitly.
        const finalLinkUrlToSend = undefined;
        const effectiveButtonText = automation.button_text || "Show me more";
        const limits = getPlanLimits(user.plan_type || "free");
        const rateLimit = await smartRateLimit(
            user.id,
            {
                hourlyLimit: limits.dmsPerHour,
                monthlyLimit: limits.dmsPerMonth,
                spreadDelay: false,
                type: 'dm',
            },
            user.created_at
        );

        if (rateLimit.allowed) {
            // Anti-Ban: 10-30s random delay
            const dmDelay = Math.floor(Math.random() * 20000) + 10000;
            logger.info(`[Anti-Ban] Delaying comment DM ${Math.round(dmDelay / 1000)}s`, { commenterUsername, automationId: automation.id });
            await new Promise(r => setTimeout(r, dmDelay));

            // STEP 1: Send exact wizard match (Text + Button in one card)
            let dmSent = false;
            let sendError = "";
            try {
                dmSent = await sendInstagramDM(
                    user.instagram_access_token,
                    user.instagram_user_id,
                    commentId,
                    commenterId,
                    dmMessage,
                    automation.id,
                    effectiveButtonText,
                    finalLinkUrlToSend,
                    undefined, // No thumbnail for greeting
                    supabase,
                    user.id,
                    undefined // Only send Fan Portal link on final delivery
                );
            } catch (e) {
                sendError = (e as Error).message || "Unknown error";
                logger.warn("DM send threw error", { commenterUsername, error: sendError });
            }

            if (dmSent) {
                await incrementAutomationCount(supabase, automation.id, "dm_sent_count");
                // Record in dm_queue for rolling window counter + monthly counter
                await recordInlineSend(user.id, {
                    commentId, commenterId, message: dmMessage, automation_id: automation.id
                });
                await (supabase as any).rpc("increment_rate_limit", { p_user_id: user.id });
                // Update log status to delivered
                await supabase
                    .from("dm_logs")
                    .update({
                        reply_sent: true,
                        reply_sent_at: new Date().toISOString()
                    })
                    .eq("instagram_comment_id", commentId);

                logger.info("Direct DM sent instantly (Rolling Window)", { commenterUsername, automationId: automation.id });
                // Set Redis frequency cap for 24h
                await setFrequencyCap(user.id, commenterId, automation.id);
                
                // Schedule follow-up DM if enabled (24h or test 2min)
                await scheduleFollowupIfEnabled(supabase, {
                    user_id: user.id,
                    instagram_user_id: commenterId,
                    automation_id: automation.id,
                    instagram_comment_id: commentId,
                    automations: automation
                });
            } else {
                // Update log status to failed with real error message
                await supabase
                    .from("dm_logs")
                    .update({
                        reply_sent: false,
                        error_message: sendError || "Instagram API delivery failed"
                    })
                    .eq("instagram_comment_id", commentId);
                logger.warn("DM API failed", { commenterUsername, error: sendError });
            }
        } else {
            logger.warn("Direct DM rate limited, pushing to queue", { userId: user.id });
            await queueDM(user.id, {
                commentId: commentId,
                commenterId: commenterId,
                message: dmMessage,
                automation_id: automation.id
            }, rateLimit.estimatedSendTime);
        }

    } catch (error) {
        logger.error("Error in handleCommentEvent", { instagramUserId }, error as Error);
    }
}

/**
 * Handle messaging events
 */
export async function handleMessageEvent(instagramUserId: string, messaging: any, supabase: any, webhookCreatedAt?: string) {
    try {
        const senderIgsid = messaging.sender?.id;
        const message = messaging.message;

        logger.info("Handling message event", {
            instagramUserId,
            sender: senderIgsid,
            messageSnippet: message?.text?.substring(0, 20),
            hasReplyTo: !!message?.reply_to,
            hasAttachments: !!message?.attachments,
            payload: JSON.stringify(messaging).substring(0, 500) // Log first 500 chars of payload
        });

        // ENFORCE 24-HOUR WINDOW (Meta Policy)
        const eventTime = webhookCreatedAt ? new Date(webhookCreatedAt).getTime() : Date.now();
        const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
        if (eventTime < (twentyFourHoursAgo + 5 * 60 * 1000)) {
            logger.warn("Skipping message older than 24 hours", { instagramUserId, senderIgsid, eventTime: new Date(eventTime).toISOString() });
            return;
        }

        // Quick Reply / Postback detection (Moved up for early usage)
        const quickReply = message?.quick_reply;
        const postbackPayload = messaging.postback?.payload || quickReply?.payload;

        const isStoryReply = !!message?.reply_to?.story;
        const isStoryMention = message?.attachments?.some(
            (att: any) => att.type === 'story_mention'
        );
        const isStandardDm = !isStoryReply && !isStoryMention && !postbackPayload;

        if (isStoryReply || isStoryMention || isStandardDm) {
            logger.info("Processing message interaction", {
                isStoryReply,
                isStoryMention,
                isStandardDm,
                sender: senderIgsid,
                text: message?.text?.substring(0, 20)
            });

            let user = await getCachedUser(instagramUserId);
            if (!user) {
                const { data: dbUser } = await supabase
                    .from("users")
                    .select("*")
                    .eq("instagram_user_id", instagramUserId)
                    .single();
                if (!dbUser) {
                    logger.warn("User not found for message event", { instagramUserId });
                    return;
                }
                user = dbUser;
                await setCachedUser(instagramUserId, dbUser);
            }

            if (!user) {
                logger.warn("User object null after DB check for message event", { instagramUserId, category: "instagram" });
                return;
            }

            // Fetch ALL potentially matching automations
            const { data: allAutomations, error: automationError } = await supabase
                .from("automations")
                .select("*")
                .eq("user_id", user.id)
                .in("trigger_type", ["story_reply", "keyword", "any", "all_posts"])
                .eq("is_active", true);

            if (automationError) {
                logger.error("Error fetching automations", { userId: user.id, error: automationError });
                return;
            }

            if (!allAutomations || allAutomations.length === 0) {
                logger.info("No active automations found for messaging", { userId: user.id });
                return;
            }

            const incomingStoryId = message?.reply_to?.story?.id || message?.reply_to?.id || message?.reply_to?.story_id;
            const incomingText = message?.text || "";

            // TIERED MATCHING LOGIC (Unified for Story & DMs)
            let automation;

            if (isStoryReply || isStoryMention) {
                // Story-specific Tiers
                // Tier 1: Specific Media + Keyword
                automation = allAutomations.find((a: any) =>
                    a.media_id === incomingStoryId &&
                    a.trigger_keyword && a.trigger_keyword.toLowerCase() !== 'any' &&
                    checkKeywordMatch(a.trigger_type, a.trigger_keyword, incomingText)
                );

                // Tier 2: Specific Media + Any
                if (!automation) {
                    automation = allAutomations.find((a: any) =>
                        a.media_id === incomingStoryId &&
                        (!a.trigger_keyword || a.trigger_keyword.toLowerCase() === 'any')
                    );
                }

                // Tier 3: Global Story + Keyword (Legacy/ALL_MEDIA fallback)
                if (!automation) {
                    automation = allAutomations.find((a: any) =>
                        (a.media_id === 'STORY_AUTOMATION' || a.media_id === 'DIRECT_MESSAGE') &&
                        a.trigger_keyword && a.trigger_keyword.toLowerCase() !== 'any' &&
                        checkKeywordMatch(a.trigger_type, a.trigger_keyword, incomingText)
                    );
                }

                // Tier 4: Global Story + Any (catch-all for story replies without keyword)
                if (!automation) {
                    automation = allAutomations.find((a: any) =>
                        (a.media_id === 'STORY_AUTOMATION' || a.media_id === 'DIRECT_MESSAGE') &&
                        (!a.trigger_keyword || a.trigger_keyword.toLowerCase() === 'any')
                    );
                }

                // Tier 5: Removed all_posts fallback for story replies 
                // to prevent reel-focused automations from triggering on stories.
                if (!automation) {
                    // No fallback needed here
                }
            } else if (isStandardDm) {
                // Standard DM Tiers (Keywords override Global Any)
                // Tier 1: Global Keyword
                automation = allAutomations.find((a: any) =>
                    (a.media_id === 'DIRECT_MESSAGE' || !a.media_id) &&
                    a.trigger_keyword && a.trigger_keyword.toLowerCase() !== 'any' &&
                    checkKeywordMatch(a.trigger_type, a.trigger_keyword, incomingText)
                );

                // Tier 2: Global Any (Catch-all for DMs)
                if (!automation) {
                    automation = allAutomations.find((a: any) =>
                        (a.media_id === 'DIRECT_MESSAGE' || !a.media_id) &&
                        (!a.trigger_keyword || a.trigger_keyword.toLowerCase() === 'any')
                    );
                }
            }

            if (!automation) {
                logger.info("No automation matched for message", {
                    userId: user.id,
                    isStory: !isStandardDm,
                    text: incomingText.substring(0, 20)
                });
                return;
            }

            // Idempotency: Use official Meta message.mid as the unique interaction ID.
            // message.mid is globally unique per message, preventing both false duplicate
            // detections and missed duplicates from synthesized ID collisions.
            // Fallback chain for cases where mid may be absent (postbacks, legacy events).
            const messageMid = message?.mid;
            const interactionId = messageMid
                ? messageMid
                : (incomingStoryId
                    ? `story_${incomingStoryId}_${senderIgsid}`
                    : (isStoryMention ? `mention_${messaging.timestamp}_${senderIgsid}` : `dm_${messaging.timestamp || Date.now()}`));

            const { data: alreadySent } = await supabase
                .from("dm_logs")
                .select("id")
                .eq("instagram_user_id", senderIgsid)
                .eq("automation_id", automation.id)
                .eq("instagram_comment_id", interactionId)
                .maybeSingle();

            if (alreadySent) {
                logger.info("Skipping duplicate message DM", { senderIgsid, interactionId });
                return;
            }

            // GLOBAL COOLING PERIOD (Anti-Spam)
            // Prevent users from receiving multiple automated DMs in a short window (1 min)
            // Scoped to ANY story interaction from this creator to this user.
            const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
            const { data: recentStoryDms } = await supabase
                .from("dm_logs")
                .select("id")
                .eq("user_id", user.id)
                .eq("instagram_user_id", senderIgsid)
                .or(`instagram_comment_id.ilike.story_%,keyword_matched.eq.STORY_REPLY,keyword_matched.eq.STORY_MENTION`)
                .gte("created_at", oneMinuteAgo)
                .limit(1);

            if (recentStoryDms && recentStoryDms.length > 0) {
                logger.info("Global Story Cooldown hit: User already received a Story DM in the last 1m", {
                    senderIgsid,
                    userId: user.id
                });
                return;
            }

            // ENFORCE FREQUENCY CAPPING (1 message per user per 24 hours PER AUTOMATION)
            // SaaS Optimization: Use Redis for 24h Frequency Cap (Ultra Fast)
            const isCapped = await checkFrequencyCap(user.id, senderIgsid, automation.id);
            if (isCapped) {
                logger.info("Frequency cap hit (Redis): User already received a DM from this automation in the last 24h", { senderIgsid, userId: user.id, automationId: automation.id });
                return;
            }

            // ATOMIC CLAIM - Insert placeholder for Message interaction
            const { error: claimError } = await supabase.from("dm_logs").insert({
                user_id: user.id,
                automation_id: automation.id,
                instagram_comment_id: interactionId,
                instagram_user_id: senderIgsid,
                instagram_username: messaging.sender?.username || "",
                keyword_matched: automation.trigger_keyword || (isStoryReply ? "STORY_REPLY" : (isStoryMention ? "STORY_MENTION" : "DM_ANY")),
                comment_text: isStandardDm ? (message?.text || "Direct Message") : (isStoryMention ? "Story Mention" : "Story Reply"),
                reply_sent: false,
                is_follow_gate: false,
            });

            if (claimError && claimError.code === '23505') {
                logger.info("Duplicate interaction prevented (already processed)", { senderIgsid, interactionId });
                return;
            }

            // 9. Send the Story DM (Rolling Window Rate Limit)
            const limits = getPlanLimits(user.plan_type || "free");
            const rateLimit = await smartRateLimit(
                user.id,
                {
                    hourlyLimit: limits.dmsPerHour,
                    monthlyLimit: limits.dmsPerMonth,
                    spreadDelay: false,
                    type: 'dm',
                },
                user.created_at
            );

            if (rateLimit.allowed) {
                // Anti-Ban: 10-30s random delay
                const msgDelay = Math.floor(Math.random() * 20000) + 10000;
                logger.info(`[Anti-Ban] Delaying story/DM reply ${Math.round(msgDelay / 1000)}s`, { senderIgsid, automationId: automation.id });
                await new Promise(r => setTimeout(r, msgDelay));

                let dmMessage = getUniqueMessage(automation.reply_message, messaging.sender?.username);

                // FAN ENGINE: Track story interaction
                if (automation.fan_mode) {
                    try {
                        const { data: fanResult } = await (supabase as any).rpc("upsert_fan", {
                            p_creator_id: user.id,
                            p_ig_user_id: senderIgsid,
                            p_ig_username: messaging.sender?.username || null,
                            p_points: isStoryMention ? 10 : 2,
                            p_action: "comment",
                        });
                        if (fanResult?.[0]) {
                            const fanMsg = checkFanMilestoneAndGetMessage(
                                user.id, senderIgsid,
                                fanResult[0].out_old_points ?? 0, fanResult[0].out_points ?? 0,
                                user.fan_rewards
                            );
                            dmMessage += fanMsg;
                        }
                    } catch (e) { logger.warn("Fan tracking failed (story)", { error: e }); }
                }

                const effectiveButtonText = automation.button_text || "Show me more";
                const finalLinkUrlToSend = undefined;

                const dmSent = await sendInstagramDM(
                    user.instagram_access_token,
                    user.instagram_user_id,
                    null,
                    senderIgsid,
                    dmMessage,
                    automation.id,
                    effectiveButtonText,
                    finalLinkUrlToSend,
                    undefined,
                    supabase,
                    user.id
                );

                if (dmSent) {
                    await incrementAutomationCount(supabase, automation.id, "dm_sent_count");
                    // Record for rolling window counter + monthly counter
                    await recordInlineSend(user.id, {
                        commentId: interactionId, commenterId: senderIgsid, message: dmMessage, automation_id: automation.id
                    });
                    await (supabase as any).rpc("increment_rate_limit", { p_user_id: user.id });
                    await supabase
                        .from("dm_logs")
                        .update({
                            reply_sent: true,
                            reply_sent_at: new Date().toISOString()
                        })
                        .eq("instagram_comment_id", interactionId);

                    logger.info("Story DM sent instantly (Rolling Window)", { senderIgsid, automationId: automation.id });
                    // Set Redis frequency cap for 24h
                    await setFrequencyCap(user.id, senderIgsid, automation.id);
                    
                    // Schedule follow-up DM if enabled
                    await scheduleFollowupIfEnabled(supabase, {
                        user_id: user.id,
                        instagram_user_id: senderIgsid,
                        automation_id: automation.id,
                        instagram_comment_id: interactionId,
                        automations: automation
                    });
                } else {
                    await supabase
                        .from("dm_logs")
                        .update({
                            reply_sent: false,
                            error_message: "Instagram API delivery failed"
                        })
                        .eq("instagram_comment_id", interactionId);
                    logger.warn("Story DM API failed", { senderIgsid });
                }
            } else {
                logger.warn("Story DM rate limited, pushing to queue", { userId: user.id });
                const dmMessage = getUniqueMessage(automation.reply_message, messaging.sender?.username);
                await queueDM(user.id, {
                    commentId: interactionId,
                    commenterId: senderIgsid,
                    message: dmMessage,
                    automation_id: automation.id
                }, rateLimit.estimatedSendTime);
            }

            return;
        }

        if (postbackPayload?.startsWith("CLICK_LINK_")) {
            const automationId = postbackPayload.replace("CLICK_LINK_", "");

            const { data: automation } = await supabase
                .from("automations")
                .select("*")
                .eq("id", automationId)
                .single();

            if (!automation) {
                logger.warn("Automation not found for postback payload", { automationId, category: "instagram" });
                return;
            }

            const { data: user } = await supabase
                .from("users")
                .select("id, instagram_access_token, instagram_user_id, instagram_username, plan_type, fan_rewards, fan_mode_enabled")
                .eq("id", automation.user_id)
                .single();

            if (!user) {
                logger.warn("User not found for postback payload automation owner", { automationUserId: automation.user_id, category: "instagram" });
                return;
            }

            // Security: Prevent cross-account payload exploits
            if (user.instagram_user_id !== instagramUserId) {
                logger.warn("Cross-account postback exploit attempt detected and blocked", {
                    webhookRecipient: instagramUserId,
                    automationOwner: user.instagram_user_id,
                    automationId: automation.id
                });
                return;
            }

            // Check if already clicked (One-shot delivery)
            const { data: interactionLog } = await supabase
                .from("dm_logs")
                .select("id, is_clicked")
                .eq("instagram_user_id", senderIgsid)
                .eq("automation_id", automation.id)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (interactionLog?.is_clicked) {
                logger.info("Automation already clicked/delivered, ignoring repeat click", { senderIgsid, automationId: automation.id });
                return;
            }

            // If follow-gate was already sent, block "Show me more" — user should use "I'm Following ✓"
            const { data: followGateLog } = await supabase
                .from("dm_logs")
                .select("id")
                .eq("instagram_user_id", senderIgsid)
                .eq("automation_id", automation.id)
                .eq("is_follow_gate", true)
                .maybeSingle();

            if (followGateLog) {
                logger.info("Follow-gate already sent, ignoring Show me more click", { senderIgsid, automationId: automation.id });
                return;
            }

            if (automation.require_follow) {
                let isFollowing = await checkIsFollowing(
                    user.instagram_access_token,
                    senderIgsid
                );

                // Fallback to our database tracking if API fails or returns false erroneously
                if (!isFollowing) {
                    isFollowing = await checkFollowStatus(supabase, user.id, senderIgsid);
                    if (isFollowing) {
                        logger.info("Follow check: API failed but DB confirmed user IS following", { senderIgsid });
                    }
                }

                if (!isFollowing) {
                    // User is not following - send follow-gate card
                    logger.info("User clicked but not following, sending follow-gate", { senderIgsid });

                    // Rate Limit Check (Follow-up to same user — dryRun only, greeting already counted)
                    const planLimits = getPlanLimits(user.plan_type || 'free');
                    const limitCheck = await smartRateLimit(user.id, {
                        hourlyLimit: planLimits.dmsPerHour,
                        monthlyLimit: planLimits.dmsPerMonth,
                        spreadDelay: false,
                        type: 'dm',
                        dryRun: true // Don't increment — follow-up to same conversation
                    });

                    if (!limitCheck.allowed) {
                        logger.warn("Rate limit hit during follow-gate click", { userId: user.id });
                        return; // Silently fail or maybe queue? For buttons, silent fail is often better than delayed surprise
                    }

                    const followGateMsg = getUniqueMessage(automation.follow_gate_message ||
                        `To unlock this, please follow us first! 👋`, messaging.sender?.username, true);

                    const cardSent = await sendFollowGateCard(
                        user.instagram_access_token,
                        instagramUserId,
                        null,
                        senderIgsid,
                        automation.id,
                        user.instagram_username || '',
                        undefined, // No thumbnail for follow-gate card
                        followGateMsg,
                        supabase,
                        user.id
                    );

                    if (cardSent) {
                        // DON'T set is_clicked here — follow-gate is intermediate, not final delivery
                        // is_clicked only gets set when the actual FINAL LINK is sent

                        // Log as follow-gate attempt (Internal Log only)
                        // Use a deterministic ID for 15s window to prevent double-clicks
                        const idempotencyKey = `${senderIgsid}_${automation.id}_gate_${Math.floor(Date.now() / 15000)}`;

                        await supabase.from("dm_logs").insert({
                            user_id: user.id,
                            automation_id: automation.id,
                            instagram_comment_id: idempotencyKey,
                            instagram_user_id: senderIgsid,
                            instagram_username: messaging.sender?.username || "",
                            keyword_matched: automation.trigger_keyword || "ANY",
                            comment_text: "Button click - follow gate",
                            reply_sent: true,
                            reply_sent_at: new Date().toISOString(),
                            is_follow_gate: true,
                            user_is_following: false,
                        });

                        await incrementAutomationCount(supabase, automation.id, "click_count");
                    }
                    return;
                }
            }

            // User is following (or no follow-gate required) - send final link

            // Rate Limit Check (Follow-up to same user — dryRun only, greeting already counted)
            const planLimits = getPlanLimits(user.plan_type || 'free');
            const limitCheck = await smartRateLimit(user.id, {
                hourlyLimit: planLimits.dmsPerHour,
                monthlyLimit: planLimits.dmsPerMonth,
                spreadDelay: false,
                type: 'dm',
                dryRun: true // Don't increment — final link is follow-up to same conversation
            });

            if (!limitCheck.allowed) {
                logger.warn("Rate limit hit during final link send", { userId: user.id });
                return;
            }

            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.replykaro.com";
            const fanPortalUrl = automation.fan_mode ? `${appUrl}/rewards/${user.id}/${senderIgsid}` : undefined;

            let finalMessage = getUniqueMessage(automation.final_message || "{Here is|Here's} the {link|info} you requested! {✨|🚀|✅}", messaging.sender?.username, true);

            // FAN ENGINE: Track button click early and combine milestone
            if (automation.fan_mode || user.fan_mode_enabled) {
                try {
                    const { data: fanResult } = await (supabase as any).rpc("upsert_fan", {
                        p_creator_id: user.id,
                        p_ig_user_id: senderIgsid,
                        p_ig_username: messaging.sender?.username || null,
                        p_points: 3,
                        p_action: "click",
                    });
                    if (fanResult?.[0]) {
                        const fanMsg = checkFanMilestoneAndGetMessage(
                            user.id, senderIgsid,
                            fanResult[0].out_old_points ?? 0, fanResult[0].out_points ?? 0,
                            user.fan_rewards
                        );
                        finalMessage += fanMsg;
                    }
                } catch (e) { logger.warn("Fan tracking failed (click)", { error: e }); }
            }

            // Identify the log record that led here (the greeting/gate log)
            const { data: interactionLogFinal } = await supabase
                .from("dm_logs")
                .select("id")
                .eq("instagram_user_id", senderIgsid)
                .eq("automation_id", automation.id)
                .eq("is_follow_gate", false) // Attribute conversion to original engagement
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            // Construct Tracking Link
            let finalLinkUrlToSend = automation.link_url || undefined;
            if (finalLinkUrlToSend && interactionLogFinal?.id) {
                finalLinkUrlToSend = `${appUrl}/api/t/${interactionLogFinal.id}`;
            }

            const dmSent = await sendInstagramDM(
                user.instagram_access_token,
                instagramUserId,
                null,
                senderIgsid,
                finalMessage,
                automation.link_url ? automation.id : undefined, // Prevent recursive POSTBACK if text-only
                automation.link_url ? (automation.final_button_text || "Open Link") : undefined,
                finalLinkUrlToSend,
                automation.media_thumbnail_url,
                supabase,
                user.id,
                fanPortalUrl,
                automation.additional_buttons
            );

            if (dmSent) {
                // We DO increment click_count though as it's a conversion.
                await incrementAutomationCount(supabase, automation.id, "click_count");

                // Update the log for the interaction that led here
                const { data: latestLog } = await supabase
                    .from("dm_logs")
                    .select("id")
                    .eq("instagram_user_id", senderIgsid)
                    .eq("automation_id", automation.id)
                    .eq("is_follow_gate", false) // Fixed: Attribute conversion to original
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (latestLog) {
                        await supabase
                            .from("dm_logs")
                            .update({ is_clicked: true })
                            .eq("id", latestLog.id);

                        // Mark follow-up as engaged (clicked)
                        await (supabase as any)
                            .from("dm_followups")
                            .update({ is_clicked: true })
                            .eq("instagram_user_id", senderIgsid)
                            .eq("automation_id", automation.id)
                            .eq("status", "scheduled");

                        // Race Condition Fix: Reschedule if already skipped
                        await (supabase as any)
                            .from("dm_followups")
                            .update({ 
                                status: "scheduled", 
                                is_clicked: true, 
                                scheduled_send_at: new Date().toISOString(),
                                error_message: null
                            })
                            .eq("instagram_user_id", senderIgsid)
                            .eq("automation_id", automation.id)
                            .eq("status", "skipped")
                            .eq("error_message", "User did not engage (No window)");
                    }
            }
            return; // Prevent fall-through to VERIFY_FOLLOW_ handler
        }

        // Handle "I'm Following" button click for follow-gate verification
        const postback = messaging.postback?.payload || quickReply?.payload;
        if (postback?.startsWith("VERIFY_FOLLOW_")) {
            const automationId = postback.replace("VERIFY_FOLLOW_", "");

            const { data: automation } = await supabase
                .from("automations")
                .select("*")
                .eq("id", automationId)
                .single();

            if (!automation) return;

            const { data: user } = await supabase
                .from("users")
                .select("id, instagram_access_token, instagram_user_id, instagram_username, plan_type, fan_rewards, fan_mode_enabled")
                .eq("id", automation.user_id)
                .single();

            if (!user) return;

            // Security: Prevent cross-account payload exploits
            if (user.instagram_user_id !== instagramUserId) {
                logger.warn("Cross-account verify-follow exploit attempt detected and blocked", {
                    webhookRecipient: instagramUserId,
                    automationOwner: user.instagram_user_id,
                    automationId: automation.id
                });
                return;
            }

            // Check if they already succeeded for this specific automation
            const { data: alreadyDone } = await supabase
                .from("dm_logs")
                .select("id")
                .eq("instagram_user_id", senderIgsid)
                .eq("automation_id", automation.id)
                .eq("followed_after_gate", true)
                .maybeSingle();

            if (alreadyDone) {
                logger.info("Final link already delivered for this automation, ignoring click", { senderIgsid });
                return;
            }

            // Check if they are NOW following via REAL-TIME Instagram API
            // This uses is_user_follow_business field (like ManyChat/SuperProfile)
            const isFollowing = await checkIsFollowing(
                user.instagram_access_token,
                senderIgsid
            );

            if (isFollowing) {
                // They are following! Send FINAL message with actual link
                logger.info("User verified as following, sending final link", { senderIgsid });

                // Rate Limit Check (Follow-up to same user — dryRun only, greeting already counted)
                const planLimits = getPlanLimits(user.plan_type || 'free');
                const limitCheck = await smartRateLimit(user.id, {
                    hourlyLimit: planLimits.dmsPerHour,
                    monthlyLimit: planLimits.dmsPerMonth,
                    spreadDelay: false,
                    type: 'dm',
                    dryRun: true // Don't increment — final link after verify is follow-up
                });

                if (!limitCheck.allowed) {
                    logger.warn("Rate limit hit during verification send", { userId: user.id });
                    return;
                }

                const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.replykaro.com";
                const fanPortalUrl = automation.fan_mode ? `${appUrl}/rewards/${user.id}/${senderIgsid}` : undefined;

                let finalMessage = getUniqueMessage(automation.final_message || automation.reply_message, messaging.sender?.username, true);

                // FAN ENGINE: Track follow verification (highest points!) + check milestones early
                if (automation.fan_mode) {
                    try {
                        let pointsToAward = 5;
                        // Prevent granting +5 points multiple times for the same fan
                        const { data: existingFan } = await supabase
                            .from("fans")
                            .select("is_following")
                            .eq("creator_id", user.id)
                            .eq("instagram_user_id", senderIgsid)
                            .maybeSingle();

                        if (existingFan?.is_following) {
                            pointsToAward = 0;
                        }

                        const { data: fanResult } = await (supabase as any).rpc("upsert_fan", {
                            p_creator_id: user.id,
                            p_ig_user_id: senderIgsid,
                            p_ig_username: messaging.sender?.username || null,
                            p_points: pointsToAward,
                            p_action: "follow",
                            p_is_following: true,
                        });
                        if (fanResult?.[0]) {
                            const fanMsg = checkFanMilestoneAndGetMessage(
                                user.id, senderIgsid,
                                fanResult[0].out_old_points ?? 0, fanResult[0].out_points ?? 0,
                                user.fan_rewards
                            );
                            finalMessage += fanMsg;
                        }
                    } catch (e) { logger.warn("Fan tracking failed (follow)", { error: e }); }
                }

                // Identify the interaction log
                const { data: followInteractionLog } = await supabase
                    .from("dm_logs")
                    .select("id")
                    .eq("instagram_user_id", senderIgsid)
                    .eq("automation_id", automation.id)
                    .eq("is_follow_gate", false)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                // Construct Tracking Link
                let finalLinkUrlToSend = automation.link_url || undefined;
                if (finalLinkUrlToSend && followInteractionLog?.id) {
                    finalLinkUrlToSend = `${appUrl}/api/t/${followInteractionLog.id}`;
                }

                const dmSent = await sendInstagramDM(
                    user.instagram_access_token,
                    instagramUserId,
                    null,
                    senderIgsid,
                    finalMessage,
                    automation.link_url ? automation.id : undefined, // Prevent recursive POSTBACK if text-only
                    automation.link_url ? (automation.final_button_text || "Open Link") : undefined,
                    finalLinkUrlToSend, // Now using tracked link!
                    undefined, // thumbnailUrl
                    supabase,
                    user.id,
                    fanPortalUrl,
                    automation.additional_buttons
                );

                if (dmSent) {
                    // FIXED: Do NOT increment dm_sent_count here (already counted in greeting)
                    // await incrementAutomationCount(supabase, automation.id, "dm_sent_count");

                    // Update the follow-gate log to mark as converted
                    await supabase
                        .from("dm_logs")
                        .update({ followed_after_gate: true, user_is_following: true })
                        .eq("instagram_user_id", senderIgsid)
                        .eq("automation_id", automation.id)
                        .eq("is_follow_gate", true);

                    // Also mark the GREETING log as clicked so "Show me more" won't re-send
                    await supabase
                        .from("dm_logs")
                        .update({ is_clicked: true })
                        .eq("instagram_user_id", senderIgsid)
                        .eq("automation_id", automation.id)
                        .eq("is_follow_gate", false);

                    // Mark follow-up as engaged (clicked)
                    await (supabase as any)
                        .from("dm_followups")
                        .update({ is_clicked: true })
                        .eq("instagram_user_id", senderIgsid)
                        .eq("automation_id", automation.id)
                        .eq("status", "scheduled");

                    // Race Condition Fix: Reschedule if already skipped
                    await (supabase as any)
                        .from("dm_followups")
                        .update({ 
                            status: "scheduled", 
                            is_clicked: true, 
                            scheduled_send_at: new Date().toISOString(),
                            error_message: null
                        })
                        .eq("instagram_user_id", senderIgsid)
                        .eq("automation_id", automation.id)
                        .eq("status", "skipped")
                        .eq("error_message", "User did not engage (No window)");
                }
            } else {
                // Not following yet - send the gate card again with a hint
                logger.info("User not yet following, sending gate again", { senderIgsid });

                // FAN ENGINE: Record not-following status (freezes points)
                if (automation.fan_mode) {
                    try {
                        await (supabase as any).rpc("upsert_fan", {
                            p_creator_id: user.id,
                            p_ig_user_id: senderIgsid,
                            p_ig_username: messaging.sender?.username || null,
                            p_points: 0,
                            p_action: "follow_check",
                            p_is_following: false,
                        });
                    } catch (e) { logger.warn("Fan tracking failed (not-following)", { error: e }); }
                }

                await sendFollowGateCard(
                    user.instagram_access_token,
                    instagramUserId,
                    null,
                    senderIgsid,
                    automation.id,
                    user.instagram_username || '',
                    undefined, // No thumbnail for follow-gate card
                    getUniqueMessage("{Hmm|Wait}, looks like you {haven't|haven't yet} followed {us|} yet! {🤔|🧐}\n\nPlease {follow us first|hit follow}, then tap '{I'm Following|Verify Follow}' again!", messaging.sender?.username, true),
                    supabase,
                    user.id
                );
            }
        }
    } catch (error) {
        logger.error("Error in handleMessageEvent", { instagramUserId }, error as Error);
    }
}

// Helper function for keyword matching
export function checkKeywordMatch(triggerType: string, triggerKeyword: string | null, commentText: string): boolean {
    // If the trigger type explicitly says 'any', or if there's no keyword, it's a catch-all
    if (triggerType.toLowerCase() === "any" || !triggerKeyword || triggerKeyword.toLowerCase().trim() === 'any') return true;

    // Normalize comment for matching
    const normalizedComment = commentText.toLowerCase().trim();

    // Support comma-separated keywords (ManyChat style)
    const keywords = triggerKeyword.toLowerCase().split(',').map(k => k.trim()).filter(k => k.length > 0);

    if (keywords.length === 0) return true;

    return keywords.some(k => normalizedComment.includes(k));
}

/**
 * Resume paused or rate-limited DMs for a user.
 * Called when a user upgrades their plan or limits increase.
 */
export async function processUserQueue(userId: string) {
    try {
        const supabase = getSupabaseAdmin();
        const now = new Date();

        // Find DMs for this user that are pending and scheduled in the future
        // (This happens when they hit the monthly limit and DMs get pushed to next month)
        const { data: queuedDMs, error: fetchError } = await (supabase as any)
            .from("dm_queue")
            .select("id")
            .eq("user_id", userId)
            .eq("status", "pending")
            .gt("scheduled_send_at", now.toISOString());

        if (fetchError) throw fetchError;

        if (queuedDMs && queuedDMs.length > 0) {
            const ids = queuedDMs.map((dm: any) => dm.id);

            // Reset scheduled_send_at to now, so the next cron run will pick them up immediately
            const { error: updateError } = await (supabase as any)
                .from("dm_queue")
                .update({
                    scheduled_send_at: now.toISOString(),
                    // Optionally bump priority so they process faster
                    priority: 10
                })
                .in("id", ids);

            if (updateError) throw updateError;

            logger.info("Resumed delayed DMs after plan upgrade", {
                userId,
                resumedCount: queuedDMs.length,
                category: "processor"
            });
        }
    } catch (error) {
        logger.error("Error resuming user queue", { userId, category: "processor" }, error as Error);
    }
}