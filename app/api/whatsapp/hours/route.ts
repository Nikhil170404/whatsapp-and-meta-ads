import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { checkRateLimit } from "@/lib/rate-limit-middleware";
import { DEFAULT_AWAY_MESSAGE, DEFAULT_TIMEZONE, DEFAULT_WEEK, validateHours } from "@/lib/whatsapp/hours";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await (getSupabaseAdmin() as any)
    .from("wa_connections").select("hours_enabled, hours, hours_timezone, away_message").eq("user_id", session.id).maybeSingle();
  return NextResponse.json({
    enabled: data?.hours_enabled ?? false,
    hours: data?.hours ?? DEFAULT_WEEK,
    timezone: data?.hours_timezone ?? DEFAULT_TIMEZONE,
    away_message: data?.away_message ?? DEFAULT_AWAY_MESSAGE,
  });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await checkRateLimit("api", `user:${session.id}`);
  if (!rl.success) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });

  const body = await req.json().catch(() => null);
  const problem = validateHours(body?.hours, body?.timezone, body?.away_message);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const supabase = getSupabaseAdmin() as any;
  const { data, error } = await supabase.from("wa_connections")
    .update({ hours_enabled: body.enabled === true, hours: body.hours, hours_timezone: body.timezone, away_message: String(body.away_message).trim() })
    .eq("user_id", session.id).select("user_id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Connect your WhatsApp number first." }, { status: 400 });
  return NextResponse.json({ success: true });
}
