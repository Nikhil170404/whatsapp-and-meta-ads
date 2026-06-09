import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { TeamClient } from "./TeamClient";

export default async function TeamPage() {
  const session = await getSession();
  if (!session) redirect("/signin");
  const supabase = getSupabaseAdmin() as any;
  const { data: members } = await supabase
    .from("team_members")
    .select("*")
    .eq("owner_user_id", session.id)
    .order("created_at", { ascending: true });
  return <TeamClient members={members ?? []} isPaidPlan={session.plan_type !== "free"} />;
}
