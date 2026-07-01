// Required DB tables:
// team_members: id, owner_user_id (fk users.id), name, email, role (default 'agent'), created_at
// wa_conversations: id, user_id (fk users.id), phone, assigned_to_member_id (fk team_members.id, nullable), updated_at

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { checkRateLimit } from "@/lib/rate-limit-middleware";

// GET — list team members for this user
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await checkRateLimit("api", `user:${session.id}`);
  if (!rl.success) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  const supabase = getSupabaseAdmin() as any;
  const { data } = await supabase
    .from("team_members")
    .select("*")
    .eq("owner_user_id", session.id)
    .order("created_at", { ascending: true });
  return NextResponse.json({ members: data ?? [] });
}

// POST — invite a team member by email/name
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await checkRateLimit("api", `user:${session.id}`);
  if (!rl.success) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  // Only paid plans
  if (session.plan_type === "free") {
    return NextResponse.json({ error: "Team inbox requires a paid plan. Upgrade to Growth or Pro." }, { status: 403 });
  }
  const supabase = getSupabaseAdmin() as any;
  const { name, email } = await req.json();
  if (!name || !email) return NextResponse.json({ error: "Name and email required" }, { status: 400 });
  const { data, error } = await supabase
    .from("team_members")
    .insert({ owner_user_id: session.id, name, email, role: "agent" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ member: data });
}

// DELETE — remove a team member
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await checkRateLimit("api", `user:${session.id}`);
  if (!rl.success) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  const supabase = getSupabaseAdmin() as any;
  const { id } = await req.json();
  await supabase.from("team_members").delete().eq("id", id).eq("owner_user_id", session.id);
  return NextResponse.json({ success: true });
}
