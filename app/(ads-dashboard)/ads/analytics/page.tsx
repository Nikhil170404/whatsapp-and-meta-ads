import { getSession } from "@/lib/auth/session";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdsAnalyticsClient } from "./AdsAnalyticsClient";

export default async function AdsAnalyticsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
  );

  const [
    { data: campaigns },
    { data: automations },
    { data: connection },
  ] = await Promise.all([
    supabase.from("ad_campaigns").select("*").eq("user_id", session.id).order("spend", { ascending: false }),
    supabase.from("ad_automations").select("*").eq("user_id", session.id),
    supabase.from("ad_connections").select("status").eq("user_id", session.id).single(),
  ]);

  return (
    <AdsAnalyticsClient
      campaigns={campaigns ?? []}
      automations={automations ?? []}
      isConnected={connection?.status === "active"}
    />
  );
}
