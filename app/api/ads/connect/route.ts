import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { NextResponse } from "next/server";

export async function DELETE() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin() as any;

    await supabase
      .from("ad_connections")
      .update({ status: "disconnected", access_token: "", page_access_token: null })
      .eq("user_id", session.id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
