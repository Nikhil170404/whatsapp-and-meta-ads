
import { getSupabaseAdmin } from "./supabase/client";
import { sendInstagramDM } from "./instagram/service";
import { logger } from "./logger";

/**
 * Process a batch of pending follow-up DMs
 */
export async function processFollowups() {
    const supabase = getSupabaseAdmin();
    const batchSize = 10;

    // 1. Claim a batch of scheduled items (Atomic Update)
    const { data: batch, error: claimError } = await (supabase as any)
        .from("dm_followups")
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .in('id', (
            await (supabase as any)
                .from("dm_followups")
                .select("id")
                .eq("status", "scheduled")
                .lte("scheduled_send_at", new Date().toISOString())
                .order("scheduled_send_at", { ascending: true })
                .limit(batchSize)
        ).data?.map((i: any) => i.id) || [])
        .select("*, users!inner(*), automations!inner(*)");

    if (claimError) {
        logger.error("Error claiming follow-up batch", { category: "followup-processor" }, claimError);
        return;
    }

    if (!batch || batch.length === 0) return;

    logger.info(`Processing ${batch.length} follow-up DMs`, { category: "followup-processor" });

    for (const item of batch) {
        try {
            // 2. Engagement Check (Required for Meta 24h Window)
            // We ONLY follow up with users who have engaged (clicked a button/link)
            // If is_clicked is false, Meta will block the message as "outside window"
            if (!item.is_clicked) {
                await markSkipped(supabase, item.id, "User did not engage (No window)");
                continue;
            }

            // 3. Meta Policy Compliance: Randomize delivery slightly
            const jitter = Math.floor(Math.random() * 10000); // 0-10s
            await new Promise(r => setTimeout(r, jitter));

            // 4. Send the DM
            const success = await sendInstagramDM(
                item.users.instagram_access_token,
                item.users.instagram_user_id,
                null, // No comment ID for follow-ups (prevents Meta error 100)
                item.instagram_user_id,
                item.message,
                item.automation_id,
                undefined, // No button for follow-ups (Meta compliance for 24h)
                undefined,
                undefined,
                supabase,
                item.user_id
            );

            if (success) {
                await (supabase as any)
                    .from("dm_followups")
                    .update({ status: 'sent', sent_at: new Date().toISOString() })
                    .eq("id", item.id);
                logger.info("Follow-up DM sent successfully", { id: item.id });
            } else {
                throw new Error("Meta API delivery failed");
            }

        } catch (error) {
            const currentAttempts = (item.attempts || 0) + 1;
            const nextTime = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // Retry in 5m
            
            if (currentAttempts >= 3) {
                await (supabase as any)
                    .from("dm_followups")
                    .update({ 
                        status: 'failed', 
                        attempts: currentAttempts, 
                        error_message: (error as Error).message 
                    })
                    .eq("id", item.id);
            } else {
                await (supabase as any)
                    .from("dm_followups")
                    .update({ 
                        status: 'scheduled', 
                        attempts: currentAttempts, 
                        scheduled_send_at: nextTime,
                        error_message: (error as Error).message 
                    })
                    .eq("id", item.id);
            }
            logger.warn("Follow-up DM failed, rescheduled", { id: item.id, attempts: currentAttempts });
        }
    }
}

async function markSkipped(supabase: any, id: string, reason: string) {
    await (supabase as any)
        .from("dm_followups")
        .update({ status: 'skipped', error_message: reason })
        .eq("id", id);
    logger.info(`Follow-up skipped: ${reason}`, { id });
}
