import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { checkRateLimit } from "@/lib/rate-limit-middleware";
import type { FlowResult } from "./ops";

/** Signed-in, rate-limited access for the flow routes. */
export async function withUser<T>(handler: (db: any, userId: string) => Promise<T>): Promise<T | NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await checkRateLimit("api", `user:${session.id}`);
  if (!rl.success) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  return handler(getSupabaseAdmin() as any, session.id);
}

export function reply<T>(r: FlowResult<T>, okStatus = 200) {
  if (!r.ok) {
    return NextResponse.json({ error: r.error, ...(r.code ? { code: r.code } : {}), ...(r.issues ? { issues: r.issues } : {}) }, { status: r.status });
  }
  return NextResponse.json(r.data, { status: okStatus });
}
