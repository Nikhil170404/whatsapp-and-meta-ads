import { getSession } from "@/lib/auth/session";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AnalyticsClient } from "./AnalyticsClient";

export default async function WaAnalyticsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
  );

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: allMessages },
    { data: recentMessages },
    { data: automations },
    { count: contactCount },
    { data: broadcasts },
  ] = await Promise.all([
    supabase.from("wa_messages").select("direction, created_at").eq("user_id", session.id).gte("created_at", thirtyDaysAgo),
    supabase.from("wa_messages").select("direction, created_at").eq("user_id", session.id).gte("created_at", sevenDaysAgo),
    supabase.from("wa_automations").select("name, sent_count, is_active").eq("user_id", session.id),
    supabase.from("wa_contacts").select("*", { count: "exact", head: true }).eq("user_id", session.id),
    supabase.from("wa_broadcasts").select("name, status, total_recipients, sent_count, delivered_count, read_count, failed_count, created_at").eq("user_id", session.id).order("created_at", { ascending: false }).limit(10),
  ]);

  return (
    <AnalyticsClient
      allMessages={allMessages ?? []}
      recentMessages={recentMessages ?? []}
      automations={automations ?? []}
      contactCount={contactCount ?? 0}
      broadcasts={broadcasts ?? []}
    />
  );
}
