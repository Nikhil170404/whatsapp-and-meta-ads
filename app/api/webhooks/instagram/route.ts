import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/client";

const IG_API_URL = "https://graph.facebook.com/v25.0";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === env.WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.object !== "instagram") {
      return NextResponse.json({ ok: true });
    }

    const supabase = getSupabaseAdmin() as any;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "comments") continue;

        const val = change.value;
        if (val.verb !== "add") continue;

        const commentId = val.id;
        const commentText: string = val.text || "";
        const fromId = val.from?.id;

        const { data: conn } = await supabase
          .from("ad_connections")
          .select("user_id, access_token")
          .eq("ig_user_id", entry.id)
          .maybeSingle();

        if (!conn) continue;

        const { data: automations } = await supabase
          .from("ad_automations")
          .select("*")
          .eq("user_id", conn.user_id)
          .eq("is_active", true);

        if (!automations?.length) continue;

        const lowerComment = commentText.toLowerCase();
        const matched = automations.find((a: any) => {
          if (!a.trigger_keyword) return true;
          return lowerComment.includes(a.trigger_keyword.toLowerCase());
        });

        if (!matched) continue;

        try {
          await fetch(`${IG_API_URL}/${commentId}/replies`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${conn.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ message: matched.reply_message }),
          });

          await supabase
            .from("ad_automations")
            .update({ sent_count: (matched.sent_count || 0) + 1 })
            .eq("id", matched.id);

          if (matched.send_dm && fromId) {
            await fetch(`${IG_API_URL}/me/messages`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${conn.access_token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                recipient: { id: fromId },
                message: { text: matched.reply_message },
              }),
            });
          }
        } catch (err) {
          console.error("Instagram automation reply error:", err);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Instagram webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
