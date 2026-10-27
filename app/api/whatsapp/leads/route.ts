import { NextResponse } from "next/server";
import { withUser } from "@/lib/flows/route-helpers";

export const GET = (req: Request) =>
  withUser(async (db, userId) => {
    const sp = new URL(req.url).searchParams;
    const limit = Math.min(Math.max(Number(sp.get("limit")) || 50, 1), 200);
    const offset = Math.max(Number(sp.get("offset")) || 0, 0);
    const { data, error, count } = await db.from("wa_leads").select("*", { count: "exact" }).eq("user_id", userId)
      .order("created_at", { ascending: false }).range(offset, offset + limit - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ leads: data, total: count ?? 0, limit, offset });
  });
