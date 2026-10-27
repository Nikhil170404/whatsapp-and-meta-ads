import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { AutomationsClient } from "./AutomationsClient";
import { BusinessHoursCard } from "@/components/wa-dashboard/BusinessHoursCard";
import { DEFAULT_AWAY_MESSAGE, DEFAULT_TIMEZONE, DEFAULT_WEEK } from "@/lib/whatsapp/hours";

export default async function WaAutomationsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const supabase = getSupabaseAdmin() as any;
  const { data: automations } = await supabase
    .from("wa_automations")
    .select("*")
    .eq("user_id", session.id)
    .order("created_at", { ascending: false });

  const { data: connection } = await supabase
    .from("wa_connections")
    .select("status, hours_enabled, hours, hours_timezone, away_message")
    .eq("user_id", session.id)
    .maybeSingle();

  return (
    <div className="space-y-8">
      <AutomationsClient initialAutomations={automations ?? []} />
      <BusinessHoursCard
        connected={!!connection}
        initial={{
          enabled: connection?.hours_enabled ?? false,
          hours: connection?.hours ?? DEFAULT_WEEK,
          timezone: connection?.hours_timezone ?? DEFAULT_TIMEZONE,
          away_message: connection?.away_message ?? DEFAULT_AWAY_MESSAGE,
        }}
      />
    </div>
  );
}
