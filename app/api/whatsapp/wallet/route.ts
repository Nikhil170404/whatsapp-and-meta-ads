import { NextResponse } from "next/server";
import crypto from "crypto";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { checkRateLimit } from "@/lib/rate-limit-middleware";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin() as any;

    const { data: connection, error: connErr } = await supabase
      .from("wa_connections")
      .select("billing_type")
      .eq("user_id", session.id)
      .single();

    if (connErr || !connection) {
      return NextResponse.json({ error: "WhatsApp not connected" }, { status: 400 });
    }

    const { data: wallet } = await supabase
      .from("wa_wallet")
      .select("balance_paise, total_topped_up_paise, total_spent_paise")
      .eq("user_id", session.id)
      .single();

    const { data: transactions } = await supabase
      .from("wa_wallet_transactions")
      .select("*")
      .eq("user_id", session.id)
      .order("created_at", { ascending: false })
      .limit(20);

    return NextResponse.json({
      wallet: wallet ?? { balance_paise: 0, total_topped_up_paise: 0, total_spent_paise: 0 },
      transactions: transactions ?? [],
      billing_type: connection.billing_type ?? "direct",
    });
  } catch (error: any) {
    console.error("Wallet GET error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch wallet" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkRateLimit("api", `user:${session.id}`);
    if (!rl.success) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });

    const body = await req.json();
    const { action } = body;

    const supabase = getSupabaseAdmin() as any;

    if (action === "set_billing_type") {
      const { billing_type } = body as { billing_type: "direct" | "managed" };
      if (billing_type !== "direct" && billing_type !== "managed") {
        return NextResponse.json({ error: "Invalid billing_type" }, { status: 400 });
      }

      // Prevent switching to direct if wallet has negative balance (defensive)
      if (billing_type === "direct") {
        const { data: wallet } = await supabase
          .from("wa_wallet")
          .select("balance_paise")
          .eq("user_id", session.id)
          .maybeSingle();
        if (wallet && (wallet.balance_paise as number) < 0) {
          return NextResponse.json({ error: "Cannot switch to direct billing with negative wallet balance" }, { status: 400 });
        }
      }

      const { error: updateErr } = await supabase
        .from("wa_connections")
        .update({ billing_type })
        .eq("user_id", session.id);

      if (updateErr) {
        console.error("set_billing_type update error:", updateErr);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      if (billing_type === "managed") {
        const { error: upsertErr } = await supabase
          .from("wa_wallet")
          .upsert({ user_id: session.id }, { onConflict: "user_id" });

        if (upsertErr) {
          console.error("set_billing_type upsert wallet error:", upsertErr);
          return NextResponse.json({ error: upsertErr.message }, { status: 500 });
        }
      }

      return NextResponse.json({ success: true, billing_type });
    }

    if (action === "create_order") {
      const { amount_inr } = body as { amount_inr: number };
      if (!amount_inr || amount_inr < 200) {
        return NextResponse.json({ error: "Minimum top-up amount is ₹200" }, { status: 400 });
      }

      const { razorpay } = await import("@/lib/razorpay");

      const order = await razorpay.orders.create({
        amount: Math.round(amount_inr * 100),
        currency: "INR",
        notes: {
          user_id: session.id,
        },
      });

      return NextResponse.json({
        order_id: order.id,
        amount: order.amount,
        key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      });
    }

    if (action === "verify_payment") {
      const { order_id, payment_id, signature, amount_inr } = body as {
        order_id: string;
        payment_id: string;
        signature: string;
        amount_inr: number;
      };

      if (!order_id || !payment_id || !signature || !amount_inr) {
        return NextResponse.json({ error: "Missing payment details" }, { status: 400 });
      }

      const secret = process.env.RAZORPAY_KEY_SECRET!;
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(`${order_id}|${payment_id}`)
        .digest("hex");

      if (expectedSignature !== signature) {
        return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
      }

      // Idempotency: reject duplicate payment_id before touching wallet balance
      const { data: existingTxn } = await supabase
        .from("wa_wallet_transactions")
        .select("id, balance_after_paise")
        .eq("razorpay_payment_id", payment_id)
        .maybeSingle();

      if (existingTxn) {
        return NextResponse.json({ success: true, balance_paise: existingTxn.balance_after_paise });
      }

      const amount_paise = Math.round(amount_inr * 100);

      const { data: currentWallet, error: walletFetchErr } = await supabase
        .from("wa_wallet")
        .select("balance_paise, total_topped_up_paise")
        .eq("user_id", session.id)
        .single();

      if (walletFetchErr || !currentWallet) {
        console.error("verify_payment fetch wallet error:", walletFetchErr);
        return NextResponse.json({ error: "Wallet not found" }, { status: 400 });
      }

      const newBalance = (currentWallet.balance_paise as number) + amount_paise;
      const newTotalToppedUp = (currentWallet.total_topped_up_paise as number) + amount_paise;

      // Insert transaction first — unique constraint on razorpay_payment_id acts as final race guard
      const { error: txnErr } = await supabase.from("wa_wallet_transactions").insert({
        user_id: session.id,
        type: "topup",
        amount_paise,
        balance_after_paise: newBalance,
        description: `Top-up of ₹${amount_inr}`,
        razorpay_order_id: order_id,
        razorpay_payment_id: payment_id,
      });

      if (txnErr) {
        // Unique constraint violation means concurrent duplicate — return current balance
        if (txnErr.code === "23505") {
          const { data: w } = await supabase.from("wa_wallet").select("balance_paise").eq("user_id", session.id).single();
          return NextResponse.json({ success: true, balance_paise: w?.balance_paise ?? currentWallet.balance_paise });
        }
        console.error("verify_payment transaction log error:", txnErr);
        return NextResponse.json({ error: txnErr.message }, { status: 500 });
      }

      const { error: updateErr } = await supabase
        .from("wa_wallet")
        .update({
          balance_paise: newBalance,
          total_topped_up_paise: newTotalToppedUp,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", session.id);

      if (updateErr) {
        console.error("verify_payment wallet update error:", updateErr);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, balance_paise: newBalance });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Wallet POST error:", error);
    return NextResponse.json({ error: error.message || "Failed to process wallet action" }, { status: 500 });
  }
}
