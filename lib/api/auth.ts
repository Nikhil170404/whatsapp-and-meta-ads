import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { checkRateLimit } from "@/lib/rate-limit-middleware";
import { hashApiKey, looksLikeApiKey } from "@/lib/api/keys";

export type ApiAuth =
  | { ok: true; userId: string; plan: string; supabase: any }
  | { ok: false; response: NextResponse };

const fail = (status: number, error: string, code?: string): ApiAuth => ({
  ok: false,
  response: NextResponse.json({ error, ...(code ? { code } : {}) }, { status }),
});

/**
 * Authenticates a request made with an API key (Authorization: Bearer rk_live_...).
 * Used by the REST API and the MCP endpoint. API access needs a paid plan.
 */
export async function authenticateApiKey(req: Request): Promise<ApiAuth> {
  const header = req.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!looksLikeApiKey(key)) {
    return fail(401, "Missing or invalid API key. Send it as: Authorization: Bearer rk_live_...", "INVALID_API_KEY");
  }

  const hashed = hashApiKey(key);
  const rl = await checkRateLimit("api", `key:${hashed.slice(0, 20)}`);
  if (!rl.success) return fail(429, "Rate limit exceeded. Slow down and retry shortly.", "RATE_LIMITED");

  const supabase = getSupabaseAdmin() as any;
  // Hashed keys are the norm; plain-text lookup keeps pre-hashing keys working.
  const { data: row } = await supabase
    .from("wa_api_keys")
    .select("user_id")
    .or(`api_key.eq.${hashed},api_key.eq.${key}`)
    .maybeSingle();
  if (!row) return fail(401, "Invalid API key.", "INVALID_API_KEY");

  const { data: user } = await supabase.from("users").select("plan_type").eq("id", row.user_id).maybeSingle();
  const plan = String(user?.plan_type ?? "free").toLowerCase();
  if (plan === "free" || plan === "expired") {
    return fail(403, "API access needs a paid plan. Upgrade to Growth or Pro.", "PLAN_REQUIRED");
  }

  // Not awaited: usage stamping must not slow the request.
  supabase.from("wa_api_keys").update({ last_used_at: new Date().toISOString() }).eq("user_id", row.user_id).then(() => {});

  return { ok: true, userId: row.user_id, plan, supabase };
}
