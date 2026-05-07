import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { BroadcastsClient } from "./BroadcastsClient";

export default async function WaBroadcastsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const supabase = getSupabaseAdmin() as any;
  const [{ data: broadcasts }, { data: templates }] = await Promise.all([
    supabase.from("wa_broadcasts").select("*").eq("user_id", session.id).order("created_at", { ascending: false }),
    supabase.from("wa_templates").select("id,name,body_text,status").eq("user_id", session.id).order("created_at", { ascending: false }),
  ]);

  return <BroadcastsClient initialBroadcasts={broadcasts ?? []} templates={templates ?? []} />;
}
