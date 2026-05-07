import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { TemplatesClient } from "./TemplatesClient";

export default async function WaTemplatesPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const supabase = getSupabaseAdmin() as any;
  const { data: templates } = await supabase
    .from("wa_templates")
    .select("*")
    .eq("user_id", session.id)
    .order("created_at", { ascending: false });

  return <TemplatesClient initialTemplates={templates ?? []} />;
}
