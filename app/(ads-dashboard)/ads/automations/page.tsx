import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { AdsAutomationsClient } from "./AdsAutomationsClient";

export default async function AdsAutomationsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const supabase = getSupabaseAdmin() as any;

  const { data: automations } = await supabase
    .from("ad_automations")
    .select("*")
    .eq("user_id", session.id)
    .order("created_at", { ascending: false });

  const { data: connection } = await supabase
    .from("ad_connections")
    .select("status")
    .eq("user_id", session.id)
    .single();

  return (
    <AdsAutomationsClient
      initialAutomations={automations ?? []}
      isConnected={connection?.status === "active"}
    />
  );
}
