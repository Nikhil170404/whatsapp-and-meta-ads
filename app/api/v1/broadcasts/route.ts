import { authenticateApiKey } from "@/lib/api/auth";
import { createBroadcast, listBroadcasts, previewBroadcast } from "@/lib/api/ops";
import { respond } from "@/lib/api/http";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return auth.response;
  return respond(await listBroadcasts(auth.supabase, auth.userId), (broadcasts) => ({ broadcasts }));
}

/**
 * Create a broadcast. It is NOT sent until you call POST /api/v1/broadcasts/{id}/send.
 * Add ?preview=true to see who would receive it without creating anything.
 */
export async function POST(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  if (new URL(req.url).searchParams.get("preview") === "true") {
    return respond(await previewBroadcast(auth.supabase, auth.userId, body));
  }
  return respond(await createBroadcast(auth.supabase, auth.userId, body), (r) => ({ broadcast: r.broadcast, scheduled: r.scheduled }), 201);
}
