import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";

const PLAN_CONFIGS: Record<string, { planId: string; name: string }> = {
  starter_monthly: {
    planId: process.env.NEXT_PUBLIC_PLAN_STARTER_PACK_MONTHLY || "",
    name: "Starter Pack Monthly",
  },
  starter_yearly: {
    planId: process.env.NEXT_PUBLIC_PLAN_STARTER_PACK_YEARLY || "",
    name: "Starter Pack Yearly",
  },
  pro_monthly: {
    planId: process.env.NEXT_PUBLIC_PLAN_PRO_PACK_MONTHLY || "",
    name: "Pro Pack Monthly",
  },
  pro_yearly: {
    planId: process.env.NEXT_PUBLIC_PLAN_PRO_PACK_YEARLY || "",
    name: "Pro Pack Yearly",
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
