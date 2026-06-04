import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { LeadsClient } from "./LeadsClient";

export default async function AdsLeadsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const supabase = getSupabaseAdmin() as any;
  const { data: leads } = await supabase
    .from("ad_leads")
    .select("*")
    .eq("user_id", session.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return <LeadsClient initialLeads={leads ?? []} />;
}
