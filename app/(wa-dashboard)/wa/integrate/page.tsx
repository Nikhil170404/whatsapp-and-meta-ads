import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { IntegrateClient } from "./IntegrateClient";

export const metadata = { title: "Integrate – ReplyKaro" };

export default async function IntegratePage() {
  const session = await getSession();
  if (!session) redirect("/signin?redirect=/wa/integrate");

  const supabase = getSupabaseAdmin() as any;
  const { data: keyRow } = await supabase
    .from("wa_api_keys")
    .select("api_key, created_at, last_used_at")
    .eq("user_id", session.id)
    .single();

  return <IntegrateClient initialKey={keyRow?.api_key ?? null} lastUsed={keyRow?.last_used_at ?? null} />;
}
