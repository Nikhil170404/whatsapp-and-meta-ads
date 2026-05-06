import { getSupabaseAdmin } from "@/lib/supabase/client";
import { getPlanByType } from "@/lib/pricing";

interface UsageResult {
    allowed: boolean;
    reason?: string;
    monthlyUsed: number;
    monthlyLimit: number;
    hourlyUsed?: number;
    hourlyLimit?: number;
    retryAfterMinutes?: number;
}

/**
 * Calculate the start date of the current usage period (billing cycle)
 * 
 * Logic:
 * 1. Find anchor date: Subscriptions.current_period_start OR Users.created_at
 * 2. Anchor day: Exact day (1-31) to match Razorpay billing cycle
 * 3. monthStart: The most recent occurrence of anchorDay (this month or last month)
 */
export async function getUsagePeriodStart(userId: string, supabase: any, planType: string): Promise<Date> {
    const now = new Date();

    // 1. For paid plans, check subscription for the authoritative billing start from Razorpay
    if (planType && planType.toLowerCase() !== 'free') {
        const { data: subData } = await supabase
            .from("subscriptions")
            .select("current_period_start")
            .eq("user_id", userId)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (subData?.current_period_start) {
            // AUTHORITATIVE: This is the exact moment the current 30-day/monthly period started
            return new Date(subData.current_period_start);
        }
    }

    // 2. Fallback for Free users: Calculate monthly anniversary based on signup date
    const { data: userData } = await supabase
        .from("users")
        .select("created_at")
        .eq("id", userId)
        .single();

    const anchorDate = userData?.created_at ? new Date(userData.created_at) : now;
    const anchorDay = anchorDate.getUTCDate();

    let monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), anchorDay, 0, 0, 0, 0));

    // If the anchor day hasn't happened yet this calendar month, the cycle started last month
    if (now.getUTCDate() < anchorDay) {
        monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, anchorDay, 0, 0, 0, 0));
    }

    return monthStart;
}

/**
 * Check if user can send more DMs
 * Only monthly limits + Instagram's hourly rate limit (180-190/hour/account)
 * NO daily limits - queue everything!
 */
export async function checkUsageLimits(userId: string, planType: string): Promise<UsageResult> {
    const supabase = getSupabaseAdmin();
    const plan = getPlanByType(planType);

    if (!plan) {
        return {
            allowed: false,
            reason: "Invalid plan",
            monthlyUsed: 0,
            monthlyLimit: 0
        };
    }

    // Get current month's usage — based on user's billing cycle!
    const startOfCycle = await getUsagePeriodStart(userId, supabase, planType);

    const { count: monthlyUsed } = await (supabase as any)
        .from("dm_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_follow_gate", false)
        .eq("reply_sent", true)
        .not("comment_text", "like", "Button click%")
        .gte("created_at", startOfCycle.toISOString());

    const monthlyCount = monthlyUsed || 0;

    // Check for waitlist DM boost (discount tier: 15K for 1 month)
    let effectiveMonthlyLimit = plan.limits.dmsPerMonth;
    const { data: userBoost } = await (supabase as any)
        .from("users")
        .select("waitlist_dms_per_month, waitlist_discount_until")
        .eq("id", userId)
        .single();

    if (userBoost?.waitlist_dms_per_month && userBoost?.waitlist_discount_until) {
        const discountExpiry = new Date(userBoost.waitlist_discount_until);
        if (discountExpiry > new Date()) {
            effectiveMonthlyLimit = userBoost.waitlist_dms_per_month;
        }
    }

    // CHECK: Only monthly limit (NO daily limits!)
    if (monthlyCount >= effectiveMonthlyLimit) {
        return {
            allowed: false,
            reason: `Monthly limit reached (${effectiveMonthlyLimit.toLocaleString()} DMs). Upgrade for more!`,
            monthlyUsed: monthlyCount,
            monthlyLimit: effectiveMonthlyLimit,
        };
    }

    // CHECK: Instagram hourly rate limit (180-195/hour per account)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const { count: hourlyUsed } = await (supabase as any)
        .from("dm_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", oneHourAgo.toISOString());

    const hourlyCount = hourlyUsed || 0;

    if (hourlyCount >= plan.limits.dmsPerHour) {
        const minutesUntilReset = 60 - Math.floor((Date.now() % (60 * 60 * 1000)) / 60000);
        return {
            allowed: false,
            reason: `Instagram rate limit (${plan.limits.dmsPerHour}/hour). Queued for processing.`,
            monthlyUsed: monthlyCount,
            monthlyLimit: effectiveMonthlyLimit,
            hourlyUsed: hourlyCount,
            hourlyLimit: plan.limits.dmsPerHour,
            retryAfterMinutes: minutesUntilReset,
        };
    }

    return {
        allowed: true,
        monthlyUsed: monthlyCount,
        monthlyLimit: effectiveMonthlyLimit,
        hourlyUsed: hourlyCount,
        hourlyLimit: plan.limits.dmsPerHour,
    };
}

/**
 * Get usage stats for dashboard display
 */
export async function getUsageStats(userId: string, planType: string) {
    const supabase = getSupabaseAdmin();
    const plan = getPlanByType(planType);

    const startOfCycle = await getUsagePeriodStart(userId, supabase, planType);

    const { count: monthlyDms } = await (supabase as any)
        .from("dm_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_follow_gate", false)
        .eq("reply_sent", true)
        .not("comment_text", "like", "Button click%")
        .gte("created_at", startOfCycle.toISOString());

    // Check for waitlist DM boost (same as checkUsageLimits)
    let effectiveDmsPerMonth = plan.limits.dmsPerMonth;
    const { data: userBoost } = await (supabase as any)
        .from("users")
        .select("waitlist_dms_per_month, waitlist_discount_until")
        .eq("id", userId)
        .single();

    if (userBoost?.waitlist_dms_per_month && userBoost?.waitlist_discount_until) {
        const discountExpiry = new Date(userBoost.waitlist_discount_until);
        if (discountExpiry > new Date()) {
            effectiveDmsPerMonth = userBoost.waitlist_dms_per_month;
        }
    }

    const { count: automationsCount } = await (supabase as any)
        .from("automations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_active", true);

    return {
        dms_sent: monthlyDms || 0,
        dms_limit: effectiveDmsPerMonth,
        dms_per_hour: plan.limits.dmsPerHour,
        automations_active: automationsCount || 0,
        automations_limit: plan.limits.automations,
        accounts_limit: plan.limits.accounts,
        percentage_used: Math.round(((monthlyDms || 0) / effectiveDmsPerMonth) * 100),
    };
}
