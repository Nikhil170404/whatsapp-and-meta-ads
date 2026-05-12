import { getSession } from "@/lib/auth/session";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdsAutomationsClient } from "./AdsAutomationsClient";

export default async function AdsAutomationsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
  );

  const { data: automations } = await supabase
    .from("ad_automations")
    .select("*")
    .eq("user_id", session.id)
    .order("created_at", { ascending: false });

  const { data: connection } = await supabase
    .from("ad_connections")
    .select("status")
    .eq("user_id", session.id)
    .single();

  return (
    <AdsAutomationsClient
      initialAutomations={automations ?? []}
      isConnected={connection?.status === "active"}
    />
  );
}
