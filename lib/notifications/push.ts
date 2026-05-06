import webPush from "web-push";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";

// Configure VAPID credentials for Web Push
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:replykaro1704@gmail.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

/**
 * Interface for notification payload
 */
interface NotificationPayload {
    title: string;
    body: string;
    tag?: string;
}

/**
 * Notify a user across enabled channels (Web Push + Email for critical events).
 * Designed to be fire-and-forget — never throws.
 */
export async function notifyUser(userId: string, type: 'dm_sent' | 'billing' | 'security', payload: NotificationPayload) {
    try {
        const supabase = getSupabaseAdmin();

        // 1. Fetch user notification preferences
        const { data: user, error } = await (supabase.from("users") as any)
            .select("notification_settings, email, instagram_username")
            .eq("id", userId)
            .single();

        if (error || !user) {
            logger.warn("Could not notify user: User not found", { userId });
            return;
        }

        const settings = (user as any).notification_settings as any;
        if (!settings) return;

        // 2. Check if this type of notification is enabled
        if (settings[type] === false) {
            logger.info("Notification skipped: User disabled this type", { userId, type });
            return;
        }

        // 3. Dispatch Web Push if token exists and VAPID is configured
        if (settings.web_push_token && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
            try {
                const subscription = JSON.parse(settings.web_push_token);
                await webPush.sendNotification(
                    subscription,
                    JSON.stringify({
                        title: payload.title,
                        body: payload.body,
                        tag: payload.tag || type,
                    })
                );
                logger.info("Web Push sent", { userId, type });
            } catch (pushError: any) {
                // 410 Gone or 404 = subscription expired, clean it up
                if (pushError?.statusCode === 410 || pushError?.statusCode === 404) {
                    logger.warn("Push subscription expired, clearing token", { userId });
                    const updatedSettings = { ...settings, web_push_token: null };
                    await (supabase.from("users") as any)
                        .update({ notification_settings: updatedSettings })
                        .eq("id", userId);
                } else {
                    logger.error("Failed to send Web Push", { userId }, pushError as Error);
                }
            }
        }

        // 4. Email for critical events (billing/security) — already handled by dedicated email functions
        // This is a fallback log; actual emails are sent by the specific route handlers via email.ts
        if ((type === 'security' || type === 'billing') && (user as any).email) {
            logger.info("Critical notification dispatched", { userId, type, channel: "push" });
        }

    } catch (error) {
        logger.error("Error in notifyUser service", { userId }, error as Error);
    }
}
