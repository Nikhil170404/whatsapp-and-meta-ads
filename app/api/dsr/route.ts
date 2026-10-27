import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { checkRateLimit } from "@/lib/rate-limit-middleware";

const schema = z.object({
  requester: z.string().trim().min(5).max(120),
  request_type: z.enum(["access", "correction", "erasure", "grievance", "withdraw_consent"]),
  details: z.string().trim().max(2000).optional(),
});

/**
 * Public endpoint for Data Principal requests under the DPDP Act 2023
 * (access, correction, erasure, grievance, withdrawal of consent).
 */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please provide your email or phone and a request type." }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await checkRateLimit("auth", `dsr:${ip}`);
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const supabase = getSupabaseAdmin() as any;
  const { data, error } = await supabase
    .from("dsr_requests")
    .insert(parsed.data)
    .select("id, due_at")
    .single();
  if (error) {
    return NextResponse.json({ error: "Could not record your request. Please email us instead." }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, respond_by: data.due_at });
}
