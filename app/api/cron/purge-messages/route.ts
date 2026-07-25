import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { verifyCronRequest } from "@/lib/cron-auth";

// Runs nightly — deletes messages older than 90 days (Meta data minimisation policy)
export async function GET(req: Request) {
  const auth = verifyCronRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const supabase = getSupabaseAdmin() as any;
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from("wa_messages")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);

  if (error) {
    console.error("Message purge error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`Purged ${count ?? 0} messages older than 90 days`);
  return NextResponse.json({ purged: count ?? 0, cutoff });
}
