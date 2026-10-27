import { authenticateApiKey } from "@/lib/api/auth";
import { deleteAutomation, updateAutomation } from "@/lib/api/ops";
import { respond } from "@/lib/api/http";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  return respond(await updateAutomation(auth.supabase, auth.userId, (await params).id, body), (automation) => ({ automation }));
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return auth.response;
  return respond(await deleteAutomation(auth.supabase, auth.userId, (await params).id));
}
