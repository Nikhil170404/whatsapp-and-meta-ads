import crypto from "crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { clearUserCache } from "@/lib/cache";

function verifySignature(body: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function planTypeFromKey(planKey: string): "starter" | "pro" {
  if (planKey?.startsWith("pro")) return "pro";
  return "starter";
}

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";

    if (!verifySignature(body, signature)) {
      return new NextResponse("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(body);
    const supabase = getSupabaseAdmin() as any;

    const subEntity = event.payload?.subscription?.entity;
    const subscriptionId: string | undefined = subEntity?.id;
    const notes = subEntity?.notes || {};
    const userId: string | undefined = notes.user_id;
    const planKey: string | undefined = notes.plan_key;

    switch (event.event) {
      case "subscription.charged": {
        if (!subscriptionId) break;
        const planType = planTypeFromKey(planKey || "");
        // current_end is Unix timestamp for next billing cycle end
        const currentEnd: number | undefined = subEntity?.current_end;
        const planExpiresAt = currentEnd ? new Date(currentEnd * 1000).toISOString() : null;

        const filter = userId ? { id: userId } : { razorpay_subscription_id: subscriptionId };
        await supabase.from("users").update({
          plan_type: planType,
          subscription_status: "active",
          razorpay_subscription_id: subscriptionId,
          plan_expires_at: planExpiresAt,
          updated_at: new Date().toISOString(),
        }).match(filter);

        if (userId) await clearUserCache(userId);
        break;
      }

      case "subscription.halted": {
        // Payment failed — keep plan but mark halted (grace period)
        if (!subscriptionId) break;
        const filter = userId ? { id: userId } : { razorpay_subscription_id: subscriptionId };
        await supabase.from("users").update({
          subscription_status: "halted",
          updated_at: new Date().toISOString(),
        }).match(filter);
        if (userId) await clearUserCache(userId);
        break;
      }

      case "subscription.cancelled": {
        if (!subscriptionId) break;
        const filter = userId ? { id: userId } : { razorpay_subscription_id: subscriptionId };
        await supabase.from("users").update({
          plan_type: "free",
          subscription_status: "cancelled",
          plan_expires_at: null,
          updated_at: new Date().toISOString(),
        }).match(filter);
        if (userId) await clearUserCache(userId);
        break;
      }

      case "subscription.completed": {
        if (!subscriptionId) break;
        const filter = userId ? { id: userId } : { razorpay_subscription_id: subscriptionId };
        await supabase.from("users").update({
          plan_type: "free",
          subscription_status: "completed",
          plan_expires_at: null,
          updated_at: new Date().toISOString(),
        }).match(filter);
        if (userId) await clearUserCache(userId);
        break;
      }

      case "payment.failed": {
        const failedSubId: string | undefined = event.payload?.payment?.entity?.subscription_id;
        if (!failedSubId) break;
        await supabase.from("users").update({
          subscription_status: "halted",
          updated_at: new Date().toISOString(),
        }).eq("razorpay_subscription_id", failedSubId);
        break;
      }
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("Razorpay webhook error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
