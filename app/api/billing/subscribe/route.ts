import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";

const PLAN_CONFIGS: Record<string, { planId: string; name: string }> = {
  // WhatsApp Growth
  growth_monthly: {
    planId: process.env.NEXT_PUBLIC_PLAN_GROWTH_MONTHLY || "",
    name: "WhatsApp Growth Plan - Monthly",
  },
  growth_monthly_usd: {
    planId: process.env.NEXT_PUBLIC_PLAN_GROWTH_MONTHLY_USD || "",
    name: "WhatsApp Growth Plan USD - Monthly",
  },
  growth_yearly: {
    planId: process.env.NEXT_PUBLIC_PLAN_GROWTH_YEARLY || "",
    name: "WhatsApp Growth Plan - Yearly",
  },
  growth_yearly_usd: {
    planId: process.env.NEXT_PUBLIC_PLAN_GROWTH_YEARLY_USD || "",
    name: "WhatsApp Growth Plan USD - Yearly",
  },
  // WhatsApp Pro
  pro_monthly: {
    planId: process.env.NEXT_PUBLIC_PLAN_PRO_MONTHLY || "",
    name: "WhatsApp Pro Plan - Monthly",
  },
  pro_monthly_usd: {
    planId: process.env.NEXT_PUBLIC_PLAN_PRO_MONTHLY_USD || "",
    name: "WhatsApp Pro Plan USD - Monthly",
  },
  pro_yearly: {
    planId: process.env.NEXT_PUBLIC_PLAN_PRO_YEARLY || "",
    name: "WhatsApp Pro Plan - Yearly",
  },
  pro_yearly_usd: {
    planId: process.env.NEXT_PUBLIC_PLAN_PRO_YEARLY_USD || "",
    name: "WhatsApp Pro Plan USD - Yearly",
  },
};

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { plan_key } = await req.json();
    const config = PLAN_CONFIGS[plan_key];

    if (!config) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    if (!config.planId) {
      return NextResponse.json({ error: "Plan not configured" }, { status: 400 });
    }

    // Lazy-load Razorpay to avoid crash if env vars missing
    const { razorpay } = await import("@/lib/razorpay");

    const subscription = await (razorpay.subscriptions as any).create({
      plan_id: config.planId,
      customer_notify: 1,
      quantity: 1,
      total_count: 12,
      notes: {
        user_id: session.id,
        plan_key,
      },
    });

    return NextResponse.json({ subscription_id: subscription.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
