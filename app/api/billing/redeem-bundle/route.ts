import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { checkRateLimit } from "@/lib/rate-limit-middleware";
import { verifyPartnerBundleCode } from "@/lib/cross-sell";

const BUNDLE_CREDIT_PAISE = 19900; // ₹199

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkRateLimit("api", `user:${session.id}`);
    if (!rl.success) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    if (!code) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    const decoded = verifyPartnerBundleCode(code);
    if (!decoded) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin() as any;

    // Insert the redemption row first — unique constraints on `code` and
    // `redeemed_by_user_id` guard against double-redeeming and double-crediting.
    // Only credit the wallet if this insert succeeds.
    const { error: redemptionErr } = await supabase.from("bundle_redemptions").insert({
      code,
      source_uid: decoded.uid,
      redeemed_by_user_id: session.id,
      granted_credit_paise: BUNDLE_CREDIT_PAISE,
    });

    if (redemptionErr) {
      if (redemptionErr.code === "23505") {
        return NextResponse.json({ error: "You've already redeemed a bundle bonus" }, { status: 409 });
      }
      console.error("redeem-bundle insert error:", redemptionErr);
      return NextResponse.json({ error: redemptionErr.message || "Failed to redeem code" }, { status: 500 });
    }

    // Ensure a wallet row exists, matching the upsert pattern used in
    // app/api/whatsapp/wallet/route.ts (set_billing_type → managed).
    const { error: upsertErr } = await supabase
      .from("wa_wallet")
      .upsert({ user_id: session.id }, { onConflict: "user_id" });

    if (upsertErr) {
      console.error("redeem-bundle upsert wallet error:", upsertErr);
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    const { data: currentWallet, error: walletFetchErr } = await supabase
      .from("wa_wallet")
      .select("balance_paise, total_topped_up_paise")
      .eq("user_id", session.id)
      .single();

    if (walletFetchErr || !currentWallet) {
      console.error("redeem-bundle fetch wallet error:", walletFetchErr);
      return NextResponse.json({ error: "Wallet not found" }, { status: 500 });
    }

    const newBalance = (currentWallet.balance_paise as number) + BUNDLE_CREDIT_PAISE;
    const newTotalToppedUp = (currentWallet.total_topped_up_paise as number) + BUNDLE_CREDIT_PAISE;

    const { error: updateErr } = await supabase
      .from("wa_wallet")
      .update({
        balance_paise: newBalance,
        total_topped_up_paise: newTotalToppedUp,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", session.id);

    if (updateErr) {
      console.error("redeem-bundle wallet update error:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    const { error: txnErr } = await supabase.from("wa_wallet_transactions").insert({
      user_id: session.id,
      type: "bundle_credit",
      amount_paise: BUNDLE_CREDIT_PAISE,
      balance_after_paise: newBalance,
      description: "Cross-sell bundle bonus (ReplyKaro Instagram)",
    });

    if (txnErr) {
      console.error("redeem-bundle transaction log error:", txnErr);
      // Wallet has already been credited and the redemption is recorded;
      // surface the error but do not roll back, same as the wallet route's
      // own best-effort logging on secondary failures.
    }

    return NextResponse.json({ success: true, creditedPaise: BUNDLE_CREDIT_PAISE });
  } catch (error: any) {
    console.error("redeem-bundle POST error:", error);
    return NextResponse.json({ error: error.message || "Failed to redeem code" }, { status: 500 });
  }
}
