import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { redirect } from "next/navigation";
import { MessagesClient } from "./MessagesClient";

export default async function WaMessagesPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const supabase = getSupabaseAdmin() as any;

  const [{ data: messages }, { data: teamMembers }, { data: templates }, { data: conversations }] = await Promise.all([
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
    supabase
      .from("wa_templates")
      .select("id, name, language, body_text, category")
      .eq("user_id", session.id)
      .eq("status", "approved")
      .neq("category", "AUTHENTICATION"),
    supabase
      .from("wa_conversations")
      .select("phone, assigned_to_member_id")
      .eq("user_id", session.id),
  ]);

  // Remember who each conversation is assigned to across page loads.
  const assignments: Record<string, string | null> = {};
  for (const c of conversations ?? []) assignments[c.phone] = c.assigned_to_member_id ?? null;

  return <MessagesClient initialMessages={messages ?? []} teamMembers={teamMembers ?? []} templates={templates ?? []} initialAssignments={assignments} />;
}
