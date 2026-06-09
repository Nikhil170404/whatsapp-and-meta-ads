import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { MessagesClient } from "./MessagesClient";

export default async function WaMessagesPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const supabase = getSupabaseAdmin() as any;

  const [{ data: messages }, { data: teamMembers }] = await Promise.all([
    supabase
      .from("wa_messages")
      .select("*")
      .eq("user_id", session.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("team_members")
      .select("id, name, email, role")
      .eq("owner_user_id", session.id)
      .order("created_at", { ascending: true }),
  ]);

  return <MessagesClient initialMessages={messages ?? []} teamMembers={teamMembers ?? []} />;
}
