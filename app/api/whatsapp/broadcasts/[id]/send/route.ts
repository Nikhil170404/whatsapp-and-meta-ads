import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { checkRateLimit } from "@/lib/rate-limit-middleware";
import { runBroadcast } from "@/lib/whatsapp/broadcast-runner";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    // Internal calls may act on behalf of a user only when they present CRON_SECRET.
    let cronUserId: string | null = null;
    const cronAuth = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && cronAuth === `Bearer ${cronSecret}`) {
      cronUserId = req.headers.get("x-cron-user-id");
    }

    const userId = session?.id || cronUserId;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: broadcastId } = await params;

    const rl = await checkRateLimit("api", `broadcast:${broadcastId}`);
    if (!rl.success) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

    const result = await runBroadcast(getSupabaseAdmin() as any, userId, broadcastId);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error: any) {
    console.error("Broadcast send error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
