import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { AdsCampaignsClient } from "./AdsCampaignsClient";

export default async function AdsCampaignsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const supabase = getSupabaseAdmin() as any;

  const [{ data: campaigns }, { data: connection }] = await Promise.all([
    supabase.from("ad_campaigns").select("*").eq("user_id", session.id).order("synced_at", { ascending: false }),
    supabase.from("ad_connections").select("status").eq("user_id", session.id).single(),
  ]);

  return (
    <AdsCampaignsClient
      initialCampaigns={campaigns ?? []}
      isConnected={connection?.status === "active"}
    />
  );
}
