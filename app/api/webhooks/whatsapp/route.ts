import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { sendTextMessage } from "@/lib/whatsapp/service";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === env.WHATSAPP_VERIFY_TOKEN) {
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

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    for (const entry of body.entry) {
      for (const change of entry.changes) {
        if (change.field === "messages") {
          const value = change.value;
          const wabaId = entry.id;
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

              const content = message.type === 'text' ? message.text.body : `[${message.type} message]`;

              // Find the connected user by phone_number_id
              const { data: connection } = await supabase
                .from("wa_connections")
                .select("user_id, access_token")
                .eq("phone_number_id", phoneNumberId)
                .single();

              if (!connection) continue;

              // Save message to DB
              await supabase.from("wa_messages").insert({
                user_id: connection.user_id,
                wa_message_id: message.id,
                from_phone: contact,
                to_phone: value.metadata.display_phone_number,
                direction: 'inbound',
                message_type: message.type,
                content: content,
                status: 'delivered'
              });

              // Check automations
              if (message.type === 'text') {
                const { data: automations } = await supabase
                  .from("wa_automations")
                  .select("*")
                  .eq("user_id", connection.user_id)
                  .eq("is_active", true);

                if (automations && automations.length > 0) {
                  const keywordMatch = automations.find(a => 
                    a.trigger_type === 'any' || 
                    (a.trigger_type === 'keyword' && a.trigger_keyword && content.toLowerCase().includes(a.trigger_keyword.toLowerCase()))
                  );

                  if (keywordMatch) {
                    try {
                      // Send Auto-reply
                      const response = await sendTextMessage(
                        phoneNumberId,
                        contact,
                        keywordMatch.reply_message,
                        connection.access_token
                      );

                      // Save outbound reply to DB
                      await supabase.from("wa_messages").insert({
                        user_id: connection.user_id,
                        wa_message_id: response.messages?.[0]?.id || `auto-${Date.now()}`,
                        from_phone: value.metadata.display_phone_number,
                        to_phone: contact,
                        direction: 'outbound',
                        message_type: 'text',
                        content: keywordMatch.reply_message,
                        status: 'sent'
                      });

                      // Increment automation count
                      await supabase
                        .from("wa_automations")
                        .update({ sent_count: keywordMatch.sent_count + 1 })
                        .eq("id", keywordMatch.id);

                    } catch (error) {
                      console.error("Failed to send WA reply:", error);
                    }
                  }
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
