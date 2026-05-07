import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { AutomationsClient } from "./AutomationsClient";

export default async function WaAutomationsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const supabase = getSupabaseAdmin() as any;
  const { data: automations } = await supabase
    .from("wa_automations")
    .select("*")
    .eq("user_id", session.id)
    .order("created_at", { ascending: false });

  return <AutomationsClient initialAutomations={automations ?? []} />;
}
