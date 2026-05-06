export const PRICING_PLANS = {
    FREE: {
        name: "Free Starter",
        price: "0",
        upfront: "0",
        duration: "Forever",
        description: "Test the waters risk-free",
        hindiDesc: "Bilkul free mein try karo",
        features: [
            "WhatsApp Business API",
            "3 Active Automations",
            "100 Contacts Limit",
            "Keyword Auto-Replies",
            "Message Inbox ✨",
            "Contact Management ✨",
            "Email Support (72h)",
        ],
        limits: {
            accounts: 1,
            automations: 3,
            contacts: 100,
            metaDirectBilling: true,
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
        name: "Platform Starter",
        price: "499",
        upfront: "0",
        duration: "Monthly",
        description: "Perfect for growing businesses",
        hindiDesc: "Growing businesses ke liye perfect",
        features: [
            "WhatsApp Business API",
            "10 Active Automations",
            "Unlimited Contacts",
            "Keyword + Welcome Triggers",
            "Template Broadcasts ✨",
            "Handle Viral Campaigns 🔥",
            "Contact CRM + Labels ✨",
            "Message Templates 💎",
            "Meta Ads Integration 🚀",
            "Email Support (48h)",
        ],
        limits: {
            accounts: 1,
            automations: 10,
            contacts: 9999999, // Unlimited
            metaDirectBilling: true,
        },
        cta: "Start Monthly Plan",
        popular: true,
        savings: "Save 20% with Yearly",
        badge: "Most Popular",
        monthlyPlanId: process.env.NEXT_PUBLIC_PLAN_STARTER_PACK_MONTHLY,
        yearlyPlanId: process.env.NEXT_PUBLIC_PLAN_STARTER_PACK_YEARLY,
        yearlyPrice: "4788", // 399/mo * 12
        usdPrice: "6",
        usdMonthlyPlanId: process.env.NEXT_PUBLIC_PLAN_STARTER_USD_MONTHLY,
        usdYearlyPlanId: process.env.NEXT_PUBLIC_PLAN_STARTER_USD_YEARLY,
        usdYearlyPrice: "60" // $5/mo * 12
    },

    PRO: {
        name: "Platform Pro",
        price: "1999",
        upfront: "0",
        duration: "Monthly",
        description: "Scale your business operations",
        hindiDesc: "Pro businesses aur teams ke liye",
        features: [
            "WhatsApp Business API",
            "Unlimited Automations",
            "Unlimited Contacts",
            "Priority Broadcast Queue",
            "Advanced CRM + Segments",
            "Multi-Campaign Support 🔥",
            "All Trigger Types ✨",
            "Advanced Meta Ads Sync 💎",
            "Detailed Analytics",
            "Priority Support (12h)",
        ],
        limits: {
            accounts: 3,
            automations: 9999999, // Defines Unlimited
            contacts: 9999999, // Unlimited
            metaDirectBilling: true,
        },
        cta: "Start Pro Plan",
        popular: false,
        savings: "Best Value - Save 25%",
        badge: "FOR TEAMS",
        monthlyPlanId: process.env.NEXT_PUBLIC_PLAN_PRO_PACK_MONTHLY,
        yearlyPlanId: process.env.NEXT_PUBLIC_PLAN_PRO_PACK_YEARLY,
        yearlyPrice: "17988", // 1499/mo * 12
        usdPrice: "24",
        usdMonthlyPlanId: process.env.NEXT_PUBLIC_PLAN_PRO_USD_MONTHLY,
        usdYearlyPlanId: process.env.NEXT_PUBLIC_PLAN_PRO_USD_YEARLY,
        usdYearlyPrice: "240" // $20/mo * 12
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
} | null {
    for (const plan of PLANS_ARRAY) {
        if (plan.monthlyPlanId === razorpayPlanId || plan.usdMonthlyPlanId === razorpayPlanId) {
            return { plan, isYearly: false };
        }
        if (plan.yearlyPlanId === razorpayPlanId || plan.usdYearlyPlanId === razorpayPlanId) {
            return { plan, isYearly: true };
        }
    }
    return null;
}

// Convert INR price to integer paisa
export const getPriceInPaisa = (priceInINR: string | null | undefined): number => {
    if (!priceInINR) return 0;
    const cleanStr = priceInINR.replace(/,/g, '');
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0 : Math.round(num * 100);
};

export const isFreePlan = (planName: string | undefined | null) => {
    if (!planName) return true;
    return planName.toLowerCase() === "free";
};

// Utility to calculate proration amount in rupees when upgrading
export function calculateUpgradeProration(
    currentPlanId: string | null,
    newPlanId: string,
    billingCycleStartDate: Date | null,
    billingCycleEndDate: Date | null
): { proratedAmountToPay: number; daysRemaining: number } | null {
    if (!currentPlanId || !billingCycleStartDate || !billingCycleEndDate) return null;

    const currentPlanDetails = getPlanByRazorpayId(currentPlanId);
    const newPlanDetails = getPlanByRazorpayId(newPlanId);

    if (!currentPlanDetails || !newPlanDetails) return null;

    // We only support upgrade math within the same currency (INR for now)
    const currentPrice = currentPlanDetails.isYearly 
        ? parseFloat(currentPlanDetails.plan.yearlyPrice || "0") 
        : parseFloat(currentPlanDetails.plan.price);
        
    const newPrice = newPlanDetails.isYearly 
        ? parseFloat(newPlanDetails.plan.yearlyPrice || "0") 
        : parseFloat(newPlanDetails.plan.price);

    // If downgrading, standard systems usually don't refund proration automatically
    if (newPrice <= currentPrice) return { proratedAmountToPay: 0, daysRemaining: 0 };

    const totalDaysInCycle = Math.ceil((billingCycleEndDate.getTime() - billingCycleStartDate.getTime()) / (1000 * 60 * 60 * 24));
    if (totalDaysInCycle <= 0) return null;

    const now = new Date();
    let daysRemaining = Math.ceil((billingCycleEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    // Safety boundaries
    if (daysRemaining < 0) daysRemaining = 0;
    if (daysRemaining > totalDaysInCycle) daysRemaining = totalDaysInCycle;

    // Proration math:
    // (Unused value of old plan) = (old price / total days) * days remaining
    // (Cost of new plan for remaining days) = (new price / total days) * days remaining
    // Diff to pay now = (new cost) - (old unused value)
    
    const costOfNewForRemaining = (newPrice / totalDaysInCycle) * daysRemaining;
    const unusedValueOfOld = (currentPrice / totalDaysInCycle) * daysRemaining;
    
    let diff = costOfNewForRemaining - unusedValueOfOld;
    if (diff < 0) diff = 0;

    // Round to 2 decimals
    return {
        proratedAmountToPay: Math.round(diff * 100) / 100,
        daysRemaining
    };
}
