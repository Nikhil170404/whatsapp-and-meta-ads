import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { AdsAnalyticsClient } from "./AdsAnalyticsClient";

export default async function AdsAnalyticsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const supabase = getSupabaseAdmin() as any;

  const [
    { data: campaigns },
    { data: automations },
    { data: connection },
  ] = await Promise.all([
    supabase.from("ad_campaigns").select("*").eq("user_id", session.id).order("spend", { ascending: false }),
    supabase.from("ad_automations").select("*").eq("user_id", session.id),
    supabase.from("ad_connections").select("status").eq("user_id", session.id).single(),
  ]);

  return (
    <AdsAnalyticsClient
      campaigns={campaigns ?? []}
      automations={automations ?? []}
      isConnected={connection?.status === "active"}
    />
  );
}
