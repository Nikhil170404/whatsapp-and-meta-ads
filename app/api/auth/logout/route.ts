import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit-middleware";

export async function GET(req: Request) {
  const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await checkRateLimit("auth", `logout:${ip}`);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const cookieStore = await cookies();
  cookieStore.delete("replykaro_session");
  return NextResponse.redirect(new URL("/signin", new URL(req.url).origin));
}
