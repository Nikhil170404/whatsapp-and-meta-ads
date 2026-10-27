import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit-middleware";
import { generateApiKey, isHashedKey } from "@/lib/api/keys";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit("api", `user:${session.id}`);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const supabase = getSupabaseAdmin() as any;
  const { data } = await supabase
    .from("wa_api_keys")
    .select("api_key, key_prefix, created_at, last_used_at")
    .eq("user_id", session.id)
    .maybeSingle();

  // Hashed keys cannot be shown again; only a masked prefix is returned.
  const key = data
    ? isHashedKey(data.api_key)
      ? { api_key: null, prefix: data.key_prefix ?? null, created_at: data.created_at, last_used_at: data.last_used_at }
      : { api_key: data.api_key, prefix: null, created_at: data.created_at, last_used_at: data.last_used_at }
    : null;

  return NextResponse.json({ key });
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit("auth", `user:${session.id}`);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const supabase = getSupabaseAdmin() as any;
  const { key, stored, display } = generateApiKey();

  const { data, error } = await supabase
    .from("wa_api_keys")
    .upsert({ user_id: session.id, api_key: stored, key_prefix: display }, { onConflict: "user_id" })
    .select("created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // The only time the full key is ever returned.
  return NextResponse.json({ key: { api_key: key, prefix: display, created_at: data.created_at } });
}
