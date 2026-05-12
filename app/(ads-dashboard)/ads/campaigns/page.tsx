import { getSession } from "@/lib/auth/session";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdsCampaignsClient } from "./AdsCampaignsClient";

export default async function AdsCampaignsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
  );

  const [{ data: campaigns }, { data: connection }] = await Promise.all([
    supabase.from("ad_campaigns").select("*").eq("user_id", session.id).order("synced_at", { ascending: false }),
    supabase.from("ad_connections").select("status").eq("user_id", session.id).single(),
  ]);

  return (
    <AdsCampaignsClient
      initialCampaigns={campaigns ?? []}
      isConnected={connection?.status === "active"}
    />
  );
}
