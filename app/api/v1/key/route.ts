import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit-middleware";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit("api", `user:${session.id}`);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const supabase = getSupabaseAdmin() as any;
  const { data } = await supabase
    .from("wa_api_keys")
    .select("api_key, created_at, last_used_at")
    .eq("user_id", session.id)
    .single();

  return NextResponse.json({ key: data ?? null });
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit("auth", `user:${session.id}`);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const supabase = getSupabaseAdmin() as any;
  const newKey = `rk_live_${crypto.randomUUID().replace(/-/g, "")}`;

  const { data, error } = await supabase
    .from("wa_api_keys")
    .upsert({ user_id: session.id, api_key: newKey }, { onConflict: "user_id" })
    .select("api_key, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ key: data });
}
