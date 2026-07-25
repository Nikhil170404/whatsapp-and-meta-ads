import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { BroadcastsClient } from "./BroadcastsClient";

export default async function WaBroadcastsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const supabase = getSupabaseAdmin() as any;
  const [{ data: broadcasts }, { data: templates }, { data: userRow }] = await Promise.all([
    supabase.from("wa_broadcasts").select("*").eq("user_id", session.id).order("created_at", { ascending: false }),
    supabase.from("wa_templates").select("id,name,body_text,status,category").eq("user_id", session.id).order("created_at", { ascending: false }),
    supabase.from("users").select("plan_type").eq("id", session.id).maybeSingle(),
  ]);

  const planType: string = (userRow?.plan_type || "free").toLowerCase();

  return <BroadcastsClient initialBroadcasts={broadcasts ?? []} templates={templates ?? []} planType={planType} />;
}
