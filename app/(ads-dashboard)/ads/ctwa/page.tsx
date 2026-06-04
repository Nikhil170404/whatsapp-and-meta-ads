import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { CTWAClient } from "./CTWAClient";

export default async function CTWAPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const supabase = getSupabaseAdmin() as any;

  const [{ data: campaigns }, { data: conn }, { data: waConn }] = await Promise.all([
    supabase.from("ctwa_campaigns").select("*").eq("user_id", session.id).order("created_at", { ascending: false }),
    supabase.from("ad_connections").select("page_id, status").eq("user_id", session.id).maybeSingle(),
    supabase.from("wa_connections").select("phone_number").eq("user_id", session.id).eq("status", "active").maybeSingle(),
  ]);

  return (
    <CTWAClient
      initialCampaigns={campaigns ?? []}
      isConnected={!!conn && conn.status === "active"}
      hasPage={!!conn?.page_id}
      waPhoneNumber={waConn?.phone_number ?? ""}
    />
  );
}
