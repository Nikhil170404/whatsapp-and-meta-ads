import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api/auth";
import { getStatus } from "@/lib/api/ops";
import { respond } from "@/lib/api/http";

export async function GET(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return auth.response;
  return respond(await getStatus(auth.supabase, auth.userId));
}
