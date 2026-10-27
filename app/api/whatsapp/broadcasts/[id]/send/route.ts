import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { checkRateLimit } from "@/lib/rate-limit-middleware";
import { queueBroadcast } from "@/lib/whatsapp/broadcast-runner";

/**
 * Queues a broadcast. Sending itself happens in the background on the worker, so
 * this returns immediately however large the audience is. Pressing it again on a
 * paused broadcast resumes it.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const rl = await checkRateLimit("api", `broadcast:${id}`);
    if (!rl.success) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

    const r = await queueBroadcast(getSupabaseAdmin() as any, session.id, id);
    if (!r.ok) return NextResponse.json({ error: r.error, ...(r.code ? { code: r.code } : {}) }, { status: r.status });
    return NextResponse.json({ success: true, queued: true, already_queued: r.already });
  } catch (error: any) {
    console.error("Broadcast queue error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
