import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { verifyCronRequest } from "@/lib/cron-auth";
import { runQualitySync } from "@/lib/jobs/quality-sync";

// Manual/fallback trigger. The Railway worker runs this job on schedule.
export async function GET(req: Request) {
  const auth = verifyCronRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  try {
    return NextResponse.json(await runQualitySync(getSupabaseAdmin() as any));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
