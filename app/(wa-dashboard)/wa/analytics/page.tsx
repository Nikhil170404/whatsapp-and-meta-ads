import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { AnalyticsClient } from "./AnalyticsClient";

export default async function WaAnalyticsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const supabase = getSupabaseAdmin() as any;


  const [
    { data: daily },
    { data: automations },
    { count: contactCount },
    { data: broadcasts },
  ] = await Promise.all([
    // Counted in the database: correct for any number of messages.
    supabase.rpc("message_daily_counts", { p_user: session.id, p_days: 30 }),
    supabase.from("wa_automations").select("name, sent_count, is_active").eq("user_id", session.id),
    supabase.from("wa_contacts").select("*", { count: "exact", head: true }).eq("user_id", session.id),
    supabase.from("wa_broadcasts").select("name, status, total_recipients, sent_count, delivered_count, read_count, failed_count, created_at").eq("user_id", session.id).order("created_at", { ascending: false }).limit(10),
  ]);

  return (
    <AnalyticsClient
      daily={daily ?? []}
      automations={automations ?? []}
      contactCount={contactCount ?? 0}
      broadcasts={broadcasts ?? []}
    />
  );
}
