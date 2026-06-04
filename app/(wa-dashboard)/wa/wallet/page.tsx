import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { WalletClient } from "./WalletClient";

export default async function WalletPage() {
  const session = await getSession();
  if (!session) redirect("/signin");
  const supabase = getSupabaseAdmin() as any;

  const [{ data: wallet }, { data: transactions }, { data: connection }] = await Promise.all([
    supabase.from("wa_wallet").select("*").eq("user_id", session.id).single(),
    supabase.from("wa_wallet_transactions").select("*").eq("user_id", session.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("wa_connections").select("billing_type, status").eq("user_id", session.id).single(),
  ]);

  return <WalletClient
    wallet={wallet || { balance_paise: 0, total_topped_up_paise: 0, total_spent_paise: 0 }}
    transactions={transactions || []}
    billingType={connection?.billing_type || "direct"}
    waConnected={connection?.status === "active"}
    razorpayKeyId={process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || ""}
  />;
}
