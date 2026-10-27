import { authenticateApiKey } from "@/lib/api/auth";
import { createTemplate, listTemplates } from "@/lib/api/ops";
import { respond } from "@/lib/api/http";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return auth.response;
  return respond(await listTemplates(auth.supabase, auth.userId), (templates) => ({ templates }));
}

export async function POST(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  return respond(await createTemplate(auth.supabase, auth.userId, body), (r) => ({ template: r.template, meta_error: r.meta_error }), 201);
}
