export const PRICING_PLANS = {
    FREE: {
        name: "Free Starter",
        price: "0",
        upfront: "0",
        duration: "Forever",
        description: "Test the waters risk-free",
        hindiDesc: "Bilkul free mein try karo",
        features: [
            "1 Instagram Account",
            "3 Active Automations",
            "1,000 DMs/month",
            "Standard Delivery Speed",
            "Queue All Comments ✨",
            "Follow-Gate Feature ✨",
            "Fan Mode (Points Tracking) 💎",
            "Email Support (72h)",
        ],
        limits: {
            accounts: 1,
            automations: 3,
            dmsPerMonth: 1000,
            dmsPerHour: 180, // Safe Starter Speed
            // INTERNAL SAFETY: 180 comments/hr. Meta's official Private Replies API limit is 750/hour. We stay well under.
            commentsPerHour: 180,
            queueEnabled: true,
            priorityQueue: false,
        },
        cta: "Free Forever",
        popular: false,
        savings: null,
        badge: "FREE",
        monthlyPlanId: null,
        yearlyPlanId: null,
        yearlyPrice: null,
        usdPrice: "0",
        usdMonthlyPlanId: null,
        usdYearlyPlanId: null,
        usdYearlyPrice: null
    },

    STARTER: {
        name: "Starter Pack",
        price: "99",
        upfront: "0",
        duration: "Monthly",
        description: "Perfect for growing creators",
        hindiDesc: "Naye creators ke liye perfect",
        features: [
            "1 Instagram Account",
            "10 Active Automations",
            "30,000 DMs/month",
            "All Active Automations Priority",
            "Queue All Comments",
            "Handle Viral Posts 🔥",
            "Story Automation ✨",
            "Follow-Gate Feature ✨",
            "Fan Mode (Custom Rewards) 💎",
            "Daily Streak Bonuses 🔥",
            "Email Support (48h)",
        ],
        limits: {
            accounts: 1,
            automations: 10,
            dmsPerMonth: 30000,
            dmsPerHour: 300, // Starter Speed — DMs + Comments both at 300/hr
            commentsPerHour: 300,
            queueEnabled: true,
            priorityQueue: false,
        },
        cta: "Start Monthly Plan",
        popular: false,
        savings: "Get 2 months free with Yearly",
        badge: "Most Affordable",
        monthlyPlanId: process.env.NEXT_PUBLIC_PLAN_STARTER_PACK_MONTHLY,
        yearlyPlanId: process.env.NEXT_PUBLIC_PLAN_STARTER_PACK_YEARLY,
        yearlyPrice: "999",
        usdPrice: "3",
        usdMonthlyPlanId: process.env.NEXT_PUBLIC_PLAN_STARTER_USD_MONTHLY,
        usdYearlyPlanId: process.env.NEXT_PUBLIC_PLAN_STARTER_USD_YEARLY,
        usdYearlyPrice: "30"
    },

    PRO: {
        name: "Pro Pack",
        price: "299",
        upfront: "0",
        duration: "Monthly",
        description: "Scale your engagement",
        hindiDesc: "Pro creators aur teams ke liye",
        features: [
            "1 Instagram Account",
            "Unlimited Automations",
            "250,000 DMs/month",
            "Priority Delivery Queue",
            "Instant Queue Processing",
            "Handle Multiple Viral Posts 🔥",
            "Story Automation ✨",
            "Follow-Gate Feature ✨",
            "Fan Mode (Loyalty Engine) 💎",
            "Re-engagement Bonuses 🎁",
            "Detailed Analytics",
            "Priority Support (12h)",
        ],
        limits: {
            accounts: 1,
            automations: 9999999, // Defines Unlimited
            dmsPerMonth: 250000,
            dmsPerHour: 450, // Pro Speed — DMs + Comments both at 450/hr (under Meta's 750/hr limit)
            commentsPerHour: 450,
            queueEnabled: true,
            priorityQueue: true,
        },
        cta: "Start Pro Plan",
        popular: true,
        savings: "Best Value - Save 16%",
        badge: "Most Popular",
        monthlyPlanId: process.env.NEXT_PUBLIC_PLAN_PRO_PACK_MONTHLY,
        yearlyPlanId: process.env.NEXT_PUBLIC_PLAN_PRO_PACK_YEARLY,
        yearlyPrice: "2999",
        usdPrice: "9",
        usdMonthlyPlanId: process.env.NEXT_PUBLIC_PLAN_PRO_USD_MONTHLY,
        usdYearlyPlanId: process.env.NEXT_PUBLIC_PLAN_PRO_USD_YEARLY,
        usdYearlyPrice: "90"
    }
};

export const PLANS_ARRAY = Object.values(PRICING_PLANS);

// Plan hierarchy for upgrade/downgrade validation (higher = more premium)
export const PLAN_HIERARCHY: Record<string, number> = {
    free: 0,
    starter: 1,
    pro: 2,
};

// Helper to get plan by Razorpay plan ID (monthlyPlanId or yearlyPlanId)
export function getPlanByRazorpayId(razorpayPlanId: string): {
    plan: (typeof PLANS_ARRAY)[number];
    isYearly: boolean;
    planType: string;
} | null {
    for (const plan of PLANS_ARRAY) {
        if (plan.yearlyPlanId === razorpayPlanId || (plan as any).usdYearlyPlanId === razorpayPlanId) {
            const planType = plan.name === "Pro Pack" ? "pro" : plan.name === "Starter Pack" ? "starter" : "free";
            return { plan, isYearly: true, planType };
        }
        if (plan.monthlyPlanId === razorpayPlanId || (plan as any).usdMonthlyPlanId === razorpayPlanId) {
            const planType = plan.name === "Pro Pack" ? "pro" : plan.name === "Starter Pack" ? "starter" : "free";
            return { plan, isYearly: false, planType };
        }
    }
    return null;
}

// Helper to get plan by name
export function getPlanByName(name: string) {
    return Object.values(PRICING_PLANS).find(p => p.name === name);
}

// Helper to get plan by type
export function getPlanByType(type: string) {
    return PRICING_PLANS[type.toUpperCase() as keyof typeof PRICING_PLANS] || PRICING_PLANS.FREE;
}

// Helper to check feature access
export function hasFeature(planType: string, feature: string): boolean {
    const featureMap: Record<string, string[]> = {
        free: ["follow_gate", "basic_automation", "queue", "fan_mode_basic"],
        starter: ["follow_gate", "story_automation", "basic_analytics", "queue", "viral_handling", "fan_mode_custom", "streak_rewards", "followup_dm"],
        pro: ["follow_gate", "story_automation", "detailed_analytics", "queue", "priority_queue", "viral_handling", "fan_mode_full", "reengagement_bonus", "followup_dm"],
    };

    return featureMap[planType.toLowerCase()]?.includes(feature) || false;
}

// Get limits for a plan type
export function getPlanLimits(planType: string): {
    accounts: number;
    automations: number;
    dmsPerMonth: number;
    dmsPerHour: number;
    commentsPerHour: number;
    planName: string;
    queueEnabled?: boolean;
    priorityQueue?: boolean;
} {
    const planMap: Record<string, typeof PRICING_PLANS.FREE.limits & { planName: string }> = {
        free: { ...PRICING_PLANS.FREE.limits, planName: "Free Starter" },
        starter: { ...PRICING_PLANS.STARTER.limits, planName: "Starter Pack" },
        pro: { ...PRICING_PLANS.PRO.limits, planName: "Pro Pack" },
    };

    return planMap[planType?.toLowerCase()] || planMap.free;
}

// Check if user can create more automations
export function canCreateAutomation(planType: string, currentCount: number): boolean {
    const limits = getPlanLimits(planType);
    return currentCount < limits.automations;
}

// Check if user can send more DMs this month
export function canSendDM(planType: string, currentMonthCount: number): boolean {
    const limits = getPlanLimits(planType);
    return currentMonthCount < limits.dmsPerMonth;
}

// Get upgrade suggestion based on current plan
export function getUpgradeSuggestion(planType: string): {
    nextPlan: string;
    nextPlanPrice: string;
    benefits: string[];
} | null {
    const upgrades: Record<string, { nextPlan: string; nextPlanPrice: string; benefits: string[] }> = {
        free: {
            nextPlan: "Starter Pack",
            nextPlanPrice: "₹99/month",
            benefits: ["10 Automations", "30,000 DMs/month", "Story Automation", "Handle Viral Posts"]
        },
        starter: {
            nextPlan: "Pro Pack",
            nextPlanPrice: "₹299/month",
            benefits: ["Unlimited Automations", "250,000 DMs", "Priority Support", "Detailed Analytics"]
        }
    };

    return upgrades[planType?.toLowerCase()] || upgrades.free;
}
