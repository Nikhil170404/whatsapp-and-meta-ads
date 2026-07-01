import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { sendTextMessage } from "@/lib/whatsapp/service";
import { refreshWaTokenIfNeeded } from "@/lib/whatsapp/token";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { verifyMetaSignature } from "@/lib/meta-signature";

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
    const rawBody = await req.text();

    if (!verifyMetaSignature(rawBody, req.headers.get("x-hub-signature-256"))) {
      return new NextResponse("Invalid signature", { status: 401 });
    }

    const body = JSON.parse(rawBody);

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
                .select("user_id, access_token, token_expires_at, billing_type")
                .eq("phone_number_id", phoneNumberId)
                .single();

              if (!connection) continue;

              // Auto-refresh token if expiring within 7 days
              const validToken = await refreshWaTokenIfNeeded(supabase, { ...connection, phone_number_id: phoneNumberId });

              // Handle STOP / opt-out before anything else
              const stopWords = ["stop", "unsubscribe", "opt out", "optout", "remove me", "cancel subscription", "no messages"];
              const isOptOut = message.type === "text" && stopWords.some(w => content.toLowerCase().trim() === w || content.toLowerCase().trim().startsWith(w + " "));
              if (isOptOut) {
                await supabase.from("wa_contacts").upsert({
                  user_id: connection.user_id,
                  phone_number: contact,
                  is_opted_in: false,
                  opted_out_at: new Date().toISOString(),
                }, { onConflict: "user_id,phone_number" });
                // Send one-time opt-out acknowledgment
                try {
                  const validToken = await refreshWaTokenIfNeeded(supabase, { ...connection, phone_number_id: phoneNumberId });
                  await sendTextMessage(phoneNumberId, contact, "You've been unsubscribed from our messages. Reply START any time to opt back in.", validToken);
                } catch {}
                continue;
              }

              // Handle START / opt back in
              if (message.type === "text" && ["start", "subscribe", "opt in", "optin", "yes"].includes(content.toLowerCase().trim())) {
                await supabase.from("wa_contacts").upsert({
                  user_id: connection.user_id,
                  phone_number: contact,
                  is_opted_in: true,
                  opted_in_at: new Date().toISOString(),
                  opted_out_at: null,
                }, { onConflict: "user_id,phone_number" });
              }

              // Record opt-in when contact messages for the first time
              await supabase.from("wa_contacts").upsert({
                user_id: connection.user_id,
                phone_number: contact,
                last_message_at: new Date().toISOString(),
              }, { onConflict: "user_id,phone_number" }).then(async () => {
                // Set opted_in_at only if not already set (first time contact)
                const { data: existingContact } = await supabase
                  .from("wa_contacts")
                  .select("opted_in_at")
                  .eq("user_id", connection.user_id)
                  .eq("phone_number", contact)
                  .maybeSingle();
                if (existingContact && !existingContact.opted_in_at) {
                  await supabase.from("wa_contacts").update({ opted_in_at: new Date().toISOString() })
                    .eq("user_id", connection.user_id).eq("phone_number", contact);
                }
              });

              // Save message to DB. wa_message_id is UNIQUE, so a duplicate
              // insert means Meta re-delivered this event — skip the whole
              // automation flow to avoid charging and replying twice.
              const { error: insertErr } = await supabase.from("wa_messages").insert({
                user_id: connection.user_id,
                wa_message_id: message.id,
                from_phone: contact,
                to_phone: value.metadata.display_phone_number,
                direction: "inbound",
                message_type: message.type,
                content: content,
                status: "delivered",
              });
              if (insertErr) {
                // 23505 = unique violation = already processed this message
                if (insertErr.code === "23505") continue;
                console.error("Failed to save inbound message:", insertErr);
              }

              // Only check automations for text messages and opted-in contacts
              if (message.type !== "text") continue;
              const { data: contactRow } = await supabase
                .from("wa_contacts")
                .select("is_opted_in")
                .eq("user_id", connection.user_id)
                .eq("phone_number", contact)
                .maybeSingle();
              if (contactRow?.is_opted_in === false) continue;

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

              // For managed billing: atomically deduct BEFORE sending
              let walletNewBal: number | null = null;
              if (connection.billing_type === "managed") {
                const { data: deducted, error: deductErr } = await supabase.rpc("deduct_wallet_balance", {
                  p_user_id: connection.user_id,
                  p_amount: 95,
                });
                if (deductErr) {
                  await supabase.from("wa_automations")
                    .update({ last_error: "Wallet empty — top up your ReplyKaro wallet to resume auto-replies" })
                    .eq("id", matchedAutomation.id);
                  continue;
                }
                walletNewBal = deducted as number;
              }

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
                  .update({
                    sent_count: matchedAutomation.sent_count + 1,
                    last_fired_at: new Date().toISOString(),
                    last_error: null,
                  })
                  .eq("id", matchedAutomation.id);

                if (connection.billing_type === "managed" && walletNewBal !== null) {
                  await supabase.from("wa_wallet_transactions").insert({
                    user_id: connection.user_id,
                    type: "debit",
                    amount_paise: 95,
                    balance_after_paise: walletNewBal,
                    description: `Auto-reply to ${contact}`,
                  });
                }

                // Clear any previous connection error on success
                await supabase
                  .from("wa_connections")
                  .update({ last_error: null, last_error_at: null })
                  .eq("phone_number_id", phoneNumberId);

              } catch (error: any) {
                console.error("Failed to send WA auto-reply:", error);

                // Refund the managed-billing deduction — the message never sent,
                // so the user must not be charged for it.
                if (connection.billing_type === "managed" && walletNewBal !== null) {
                  const { data: w } = await supabase
                    .from("wa_wallet")
                    .select("balance_paise, total_spent_paise")
                    .eq("user_id", connection.user_id)
                    .single();
                  if (w) {
                    await supabase.from("wa_wallet").update({
                      balance_paise: (w.balance_paise as number) + 95,
                      total_spent_paise: Math.max(0, (w.total_spent_paise as number) - 95),
                      updated_at: new Date().toISOString(),
                    }).eq("user_id", connection.user_id);
                  }
                }

                // Parse the Meta error message for a clean display string
                let errorMsg = error?.message || "Unknown error sending reply";
                try {
                  const parsed = JSON.parse(errorMsg.replace(/^WhatsApp API Error: /, ""));
                  const e = parsed?.error;
                  errorMsg = e ? `(#${e.code}) ${e.message}` : errorMsg;
                } catch {}

                // Write error to DB so it's visible in the UI
                await supabase
                  .from("wa_connections")
                  .update({ last_error: errorMsg, last_error_at: new Date().toISOString() })
                  .eq("phone_number_id", phoneNumberId);

                await supabase
                  .from("wa_automations")
                  .update({ last_error: errorMsg })
                  .eq("id", matchedAutomation.id);

                // Mark token as expired if Meta says so
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
