import { NextResponse } from "next/server";
import { withUser } from "@/lib/flows/route-helpers";
import { leadsToCsv } from "@/lib/flows/csv";

/** Up to 10,000 of the newest leads as a spreadsheet-friendly CSV. */
export const GET = () =>
  withUser(async (db, userId) => {
    const { data, error } = await db.from("wa_leads").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(10000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return new NextResponse(leadsToCsv(data ?? []), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="leads.csv"' },
    });
  });
