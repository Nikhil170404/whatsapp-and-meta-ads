import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { checkRateLimit } from "@/lib/rate-limit-middleware";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkRateLimit("analytics", `user:${session.id}`);
    if (!rl.success) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });

    const supabase = getSupabaseAdmin() as any;
    const { data, error } = await supabase
      .from("ad_leads")
      .select("*")
      .eq("user_id", session.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    return NextResponse.json({ leads: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
