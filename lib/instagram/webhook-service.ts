import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { handleCommentEvent, handleMessageEvent } from "@/lib/instagram/processor";
import { recordFollowEvent } from "@/lib/instagram/service";
import { logger } from "@/lib/logger";

interface WebhookEvent {
    object: string;
    entry: any[];
}

export class InstagramWebhookService {
    /**
     * Verify the X-Hub-Signature-256 header from Meta
     */
    static verifySignature(rawBody: string, signature: string | null): boolean {
        if (process.env.NODE_ENV !== "production" && process.env.ALLOW_UNSIGNED_WEBHOOKS === "true") {
            // 1.4: Make dev bypass visible in logs
            logger.warn("SECURITY: Webhook signature verification BYPASSED — ALLOW_UNSIGNED_WEBHOOKS is enabled", { category: "webhook" });
            return true;
        }

        if (!signature || !process.env.INSTAGRAM_APP_SECRET) return false;

        const expectedSignature = crypto
            .createHmac('sha256', process.env.INSTAGRAM_APP_SECRET)
            .update(rawBody)
            .digest('hex');

        // 1.2: Use timing-safe comparison to prevent timing attacks
        const expectedSig = `sha256=${expectedSignature}`;
        const expectedBuf = Buffer.from(expectedSig, "utf-8");
        const receivedBuf = Buffer.from(signature, "utf-8");

        if (expectedBuf.length !== receivedBuf.length) return false;
        return crypto.timingSafeEqual(expectedBuf, receivedBuf);
    }

    /**
     * Process the webhook payload
     * - Handles 'comments' instantly or batches them if load is high
     * - Handles 'follows' for Follow-Gate
     * - Handles 'messages' (DMs, Story Replies)
     */
    static async processWebhookEvents(body: WebhookEvent) {
        const supabase = getSupabaseAdmin();
        const batchInserts: any[] = [];
        const instantCommentResults: any[] = [];
        const instantMessageResults: any[] = [];

        // 1. Collect all events
        for (const entry of body.entry || []) {
            const instagramUserId = entry.id;

            // Handle comments
            for (const change of entry.changes || []) {
                if (change.field === "comments") {
                    const event = { type: 'comment', igId: instagramUserId, data: change.value };
                    // If burst is small (< 5), try instant processing
                    if (instantCommentResults.length < 5) {
                        instantCommentResults.push(handleCommentEvent(instagramUserId, change.value, supabase));
                    } else {
                        batchInserts.push({ instagram_user_id: instagramUserId, event_type: 'comment', payload: change.value });
                    }
                }

                // Handle follow events for Follow-Gate feature
                if (change.field === "follows") {
                    const followData = change.value;
                    // Get the user ID from our database
                    const { data: user } = await (supabase as any)
                        .from("users")
                        .select("id")
                        .eq("instagram_user_id", instagramUserId)
                        .single();

                    if (user && followData) {
                        // Record the follow event in our tracking table
                        await recordFollowEvent(
                            supabase,
                            user.id,
                            followData.from?.id || followData.user_id,
                            followData.from?.username,
                            true // is following
                        );
                        logger.info("Recorded follow", { username: followData.from?.username || 'unknown', category: "webhook" });
                    }
                }
            }

            // Handle messaging
            for (const messaging of entry.messaging || []) {
                if (!messaging.message?.is_echo) {
                    const isStoryReply = !!messaging.message?.reply_to?.story_id;
                    const eventType = isStoryReply ? 'story_reply' : 'message';

                    if (instantMessageResults.length < 5) {
                        instantMessageResults.push(handleMessageEvent(instagramUserId, messaging, supabase));
                    } else {
                        batchInserts.push({ instagram_user_id: instagramUserId, event_type: eventType, payload: messaging });
                    }
                }
            }
        }

        // 2. Process instant results
        try {
            const allInstantResults = [...instantCommentResults, ...instantMessageResults];
            if (allInstantResults.length > 0) {
                logger.info("Processing events instantly", { count: allInstantResults.length, category: "webhook" });
                const results = await Promise.allSettled(allInstantResults);

                // Log results for debugging
                results.forEach((res, idx) => {
                    if (res.status === 'rejected') {
                        logger.error("Instant process failed", { index: idx, category: "webhook" }, res.reason);
                    } else {
                        logger.info("Instant process completed", { index: idx, category: "webhook" });
                    }
                });
            }

            // 3. Batch any remainder (viral bursts)
            if (batchInserts.length > 0) {
                logger.info("Burst detected! Batching events", { count: batchInserts.length, category: "webhook" });
                const { error } = await (supabase as any)
                    .from('webhook_batch')
                    .insert(batchInserts.map(i => ({ ...i, priority: 5 })));

                if (error) logger.error("Batch insert error", { category: "webhook" }, error as Error);
            }
        } catch (err) {
            logger.error("Processing error", { category: "webhook" }, err as Error);
        }
    }
}
