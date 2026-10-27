import { authenticateApiKey } from "@/lib/api/auth";
import { createAutomation, listAutomations } from "@/lib/api/ops";
import { respond } from "@/lib/api/http";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return auth.response;
  return respond(await listAutomations(auth.supabase, auth.userId), (automations) => ({ automations }));
}

export async function POST(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  return respond(await createAutomation(auth.supabase, auth.userId, body), (automation) => ({ automation }), 201);
}
