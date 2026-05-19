import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { sendTextMessage } from "@/lib/whatsapp/service";
import { refreshWaTokenIfNeeded } from "@/lib/whatsapp/token";
import { getSupabaseAdmin } from "@/lib/supabase/client";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === env.WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.object !== "whatsapp_business_account") {
      return new NextResponse("Not Found", { status: 404 });
    }

    const supabase = getSupabaseAdmin() as any;

    for (const entry of body.entry) {
      for (const change of entry.changes) {
        if (change.field === "messages") {
          const value = change.value;
          const phoneNumberId = value.metadata.phone_number_id;

          // Process statuses (delivery/read receipts)
          if (value.statuses && value.statuses.length > 0) {
            for (const status of value.statuses) {
              await supabase
                .from("wa_messages")
                .update({ status: status.status })
                .eq("wa_message_id", status.id);
            }
          }

          // Process incoming messages
          if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
              const contact = value.contacts?.[0]?.wa_id;
              if (!contact) continue;

              const content = message.type === "text" ? message.text.body : `[${message.type} message]`;

              // Find the connected user by phone_number_id
              const { data: connection } = await supabase
                .from("wa_connections")
                .select("user_id, access_token, token_expires_at")
                .eq("phone_number_id", phoneNumberId)
                .single();

              if (!connection) continue;

              // Auto-refresh token if expiring within 7 days
              const validToken = await refreshWaTokenIfNeeded(supabase, { ...connection, phone_number_id: phoneNumberId });

              // Save message to DB
              await supabase.from("wa_messages").insert({
                user_id: connection.user_id,
                wa_message_id: message.id,
                from_phone: contact,
                to_phone: value.metadata.display_phone_number,
                direction: "inbound",
                message_type: message.type,
                content: content,
                status: "delivered",
              });

              // Only check automations for text messages
              if (message.type !== "text") continue;

              const { data: automations } = await supabase
                .from("wa_automations")
                .select("*")
                .eq("user_id", connection.user_id)
                .eq("is_active", true);

              if (!automations || automations.length === 0) continue;

              // Check if this is the sender's first-ever inbound message (for "welcome" trigger)
              const { count: priorCount } = await supabase
                .from("wa_messages")
                .select("id", { count: "exact", head: true })
                .eq("user_id", connection.user_id)
                .eq("from_phone", contact)
                .eq("direction", "inbound");

              const isFirstMessage = (priorCount ?? 0) <= 1; // 1 = the one we just inserted

              const matchedAutomation = automations.find((a: any) => {
                if (a.trigger_type === "any") return true;
                if (a.trigger_type === "welcome") return isFirstMessage;
                if (a.trigger_type === "keyword" && a.trigger_keyword) {
                  return content.toLowerCase().includes(a.trigger_keyword.toLowerCase());
                }
                return false;
              });

              if (!matchedAutomation) continue;

              try {
                const response = await sendTextMessage(
                  phoneNumberId,
                  contact,
                  matchedAutomation.reply_message,
                  validToken
                );

                await supabase.from("wa_messages").insert({
                  user_id: connection.user_id,
                  wa_message_id: response.messages?.[0]?.id || `auto-${Date.now()}`,
                  from_phone: value.metadata.display_phone_number,
                  to_phone: contact,
                  direction: "outbound",
                  message_type: "text",
                  content: matchedAutomation.reply_message,
                  status: "sent",
                });

                await supabase
                  .from("wa_automations")
                  .update({ sent_count: matchedAutomation.sent_count + 1 })
                  .eq("id", matchedAutomation.id);

              } catch (error: any) {
                console.error("Failed to send WA auto-reply:", error);
                if (error?.message?.includes('"code":190') || error?.message?.includes('"code":131005')) {
                  await supabase
                    .from("wa_connections")
                    .update({ status: "expired" })
                    .eq("phone_number_id", phoneNumberId);
                }
              }
            }
          }
        }
      }
    }

    return new NextResponse("EVENT_RECEIVED", { status: 200 });
  } catch (error) {
    console.error("WA Webhook Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
