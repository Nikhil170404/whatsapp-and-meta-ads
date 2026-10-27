import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { BroadcastsClient } from "./BroadcastsClient";
import { getAccountHealth } from "@/lib/api/ops";

export default async function WaBroadcastsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const supabase = getSupabaseAdmin() as any;
  const [{ data: broadcasts }, { data: templates }, { data: userRow }, health, { count: contactTotal }, { data: labels }] = await Promise.all([
    supabase.from("wa_broadcasts").select("*").eq("user_id", session.id).order("created_at", { ascending: false }),
    supabase.from("wa_templates").select("id,name,body_text,status,category").eq("user_id", session.id).order("created_at", { ascending: false }),
    supabase.from("users").select("plan_type").eq("id", session.id).maybeSingle(),
    getAccountHealth(supabase, session.id),
    supabase.from("wa_contacts").select("id", { count: "exact", head: true }).eq("user_id", session.id),
    supabase.rpc("distinct_contact_labels", { p_user: session.id }),
  ]);

  const planType: string = (userRow?.plan_type || "free").toLowerCase();

  return (
    <BroadcastsClient
      initialBroadcasts={broadcasts ?? []} templates={templates ?? []} planType={planType}
      health={health} contactTotal={contactTotal ?? 0} labels={Array.isArray(labels) ? labels : []}
    />
  );
}
