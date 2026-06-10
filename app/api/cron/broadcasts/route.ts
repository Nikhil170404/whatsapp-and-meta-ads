import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/client";

export async function GET(req: Request) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin() as any;
  const now = new Date().toISOString();

  const { data: due } = await supabase
    .from("wa_broadcasts")
    .select("id, user_id")
    .eq("status", "scheduled")
    .lte("scheduled_at", now);

  if (!due?.length) return NextResponse.json({ processed: 0 });

  let processed = 0;
  for (const broadcast of due) {
    try {
      // Mark as draft so send route picks it up
      await supabase
        .from("wa_broadcasts")
        .update({ status: "draft" })
        .eq("id", broadcast.id);

      // Trigger send internally. The send route only honours x-cron-user-id
      // when the CRON_SECRET is also forwarded, so pass it through here.
      const baseUrl = process.env.APP_URL || "https://replykaro.in";
      await fetch(`${baseUrl}/api/whatsapp/broadcasts/${broadcast.id}/send`, {
        method: "POST",
        headers: {
          "x-cron-user-id": broadcast.user_id,
          "Authorization": `Bearer ${process.env.CRON_SECRET}`,
          "Content-Type": "application/json",
        },
      });
      processed++;
    } catch (err) {
      console.error(`Failed to process broadcast ${broadcast.id}:`, err);
    }
  }

  return NextResponse.json({ processed });
}
