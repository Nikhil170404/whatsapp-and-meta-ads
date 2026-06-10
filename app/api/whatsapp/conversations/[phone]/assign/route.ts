// Required DB tables:
// team_members: id, owner_user_id (fk users.id), name, email, role (default 'agent'), created_at
// wa_conversations: id, user_id (fk users.id), phone, assigned_to_member_id (fk team_members.id, nullable), updated_at

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";

export async function POST(req: Request, { params }: { params: Promise<{ phone: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { phone } = await params;
  const { member_id } = await req.json();
  const supabase = getSupabaseAdmin() as any;

  // If assigning to a team member, confirm that member belongs to this owner's
  // team so a conversation can't be assigned to someone else's member.
  if (member_id) {
    const { data: member } = await supabase
      .from("team_members")
      .select("id")
      .eq("id", member_id)
      .eq("owner_user_id", session.id)
      .maybeSingle();
    if (!member) {
      return NextResponse.json({ error: "Team member not found" }, { status: 404 });
    }
  }

  await supabase.from("wa_conversations").upsert({
    user_id: session.id,
    phone,
    assigned_to_member_id: member_id || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,phone" });
  return NextResponse.json({ success: true });
}
