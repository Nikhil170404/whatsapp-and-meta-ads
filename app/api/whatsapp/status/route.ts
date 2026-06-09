import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ connected: false }, { status: 401 });

  const supabase = getSupabaseAdmin() as any;
  const { data } = await supabase
    .from("wa_connections")
    .select("status")
    .eq("user_id", session.id)
    .single();

  return NextResponse.json({ connected: data?.status === "active" });
}
