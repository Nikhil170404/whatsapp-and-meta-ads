import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { sendTextMessage } from "@/lib/whatsapp/service";

const FB_API_URL = "https://graph.facebook.com/v25.0";

// Verify webhook from Meta
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

    if (body.object !== "page" && body.object !== "instagram") {
      return NextResponse.json({ ok: true });
    }

    const supabase = getSupabaseAdmin() as any;

    for (const entry of body.entry || []) {
      const pageId = entry.id;

      for (const change of entry.changes || []) {
        if (change.field === "leadgen") {
          const leadgenId = change.value?.leadgen_id;
          if (!leadgenId) continue;

          const { data: conn } = await supabase
            .from("ad_connections")
            .select("user_id, access_token, page_id")
            .eq("page_id", pageId)
            .maybeSingle();

          if (!conn) continue;

          try {
            const leadRes = await fetch(
              `${FB_API_URL}/${leadgenId}?fields=field_data,created_time&access_token=${conn.access_token}`
            );
            const leadData: any = await leadRes.json();
            const fieldData: Array<{ name: string; values: string[] }> = leadData.field_data || [];

            const getName = () => {
              const f = fieldData.find((d) => d.name === "full_name" || d.name === "first_name");
              return f?.values?.[0] || null;
            };
            const getEmail = () => {
              const f = fieldData.find((d) => d.name === "email");
              return f?.values?.[0] || null;
            };
            const getPhone = () => {
              const f = fieldData.find((d) => d.name === "phone_number" || d.name === "phone");
              return f?.values?.[0] || null;
            };

            const name = getName();
            const email = getEmail();
            const phone = getPhone();

            await supabase.from("ad_leads").upsert({
              user_id: conn.user_id,
              page_id: conn.page_id,
              lead_id: leadgenId,
              name,
              email,
              phone,
              raw_data: fieldData,
            }, { onConflict: "lead_id" });

            if (phone) {
              const { data: waConn } = await supabase
                .from("wa_connections")
                .select("phone_number_id, access_token")
                .eq("user_id", conn.user_id)
                .eq("status", "active")
                .maybeSingle();

              if (waConn) {
                try {
                  await sendTextMessage(
                    waConn.phone_number_id,
                    phone,
                    `Hi ${name || "there"}! Thanks for your interest. We'll be in touch soon.`,
                    waConn.access_token
                  );
                  await supabase
                    .from("ad_leads")
                    .update({ whatsapp_sent: true })
                    .eq("lead_id", leadgenId);
                } catch (waErr) {
                  console.error("WhatsApp send error for lead:", waErr);
                }
              }
            }
          } catch (err) {
            console.error("Leadgen processing error:", err);
          }
          continue;
        }

        if (change.field !== "feed" && change.field !== "comments") continue;

        const val = change.value;
        // Only process comments
        if (val.item !== "comment") continue;
        if (val.verb !== "add") continue;

        const commentId = val.comment_id;
        const commentText: string = val.message || "";
        const commentFrom = val.from?.id;
        const postId = val.post_id;

        // Find connected user by page_id
        const { data: conn } = await supabase
          .from("ad_connections")
          .select("user_id, access_token")
          .eq("page_id", pageId)
          .maybeSingle();

        if (!conn) continue;

        // Find matching active automation
        const { data: automations } = await supabase
          .from("ad_automations")
          .select("*")
          .eq("user_id", conn.user_id)
          .eq("is_active", true);

        if (!automations?.length) continue;

        const lowerComment = commentText.toLowerCase();
        const matched = automations.find((a: any) => {
          if (!a.trigger_keyword) return true; // "any" trigger
          return lowerComment.includes(a.trigger_keyword.toLowerCase());
        });

        if (!matched) continue;

        // Post comment reply
        try {
          await fetch(`${FB_API_URL}/${commentId}/replies`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${conn.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ message: matched.reply_message }),
          });

          // Update sent_count
          await supabase
            .from("ad_automations")
            .update({ sent_count: (matched.sent_count || 0) + 1 })
            .eq("id", matched.id);

          // Send DM if enabled
          if (matched.send_dm && commentFrom) {
            await fetch(`${FB_API_URL}/me/messages`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${conn.access_token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                recipient: { id: commentFrom },
                message: { text: matched.reply_message },
                messaging_type: "RESPONSE",
              }),
            });
          }
        } catch (err) {
          console.error("Ad automation reply error:", err);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Facebook webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
