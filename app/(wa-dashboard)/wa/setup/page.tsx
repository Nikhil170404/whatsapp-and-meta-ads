import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { SetupWizardClient } from "./SetupWizardClient";

export default async function SetupPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const supabase = getSupabaseAdmin() as any;
  const [{ data: connection }, { data: automations }, { count: contactCount }] = await Promise.all([
    supabase.from("wa_connections").select("status").eq("user_id", session.id).single(),
    supabase.from("wa_automations").select("id").eq("user_id", session.id).limit(1),
    supabase.from("wa_contacts").select("*", { count: "exact", head: true }).eq("user_id", session.id),
  ]);

  const steps = {
    connected: connection?.status === "active",
    hasAutomation: (automations?.length ?? 0) > 0,
    hasContacts: (contactCount ?? 0) > 0,
  };

  // If all steps done, redirect to dashboard
  if (steps.connected && steps.hasAutomation && steps.hasContacts) {
    redirect("/wa");
  }

  return <SetupWizardClient steps={steps} />;
}
