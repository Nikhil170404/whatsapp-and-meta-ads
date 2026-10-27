import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { verifyMetaSignature } from "@/lib/meta-signature";
import { processWebhookBody } from "@/lib/whatsapp/webhook-processor";

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

/**
 * Verify, store, acknowledge. Meta expects a fast 200 and retries slow or failed deliveries,
 * which at volume snowballs. The payload is written to a durable queue and the worker does
 * the real work (replies, receipts, consent) at its own pace.
 *
 * If the queue write fails, the event is processed inline instead so nothing is lost.
 */
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
    const { error } = await supabase.from("wa_webhook_events").insert({ payload: body });
    if (error) {
      console.error("Webhook queue write failed, processing inline:", error.message);
      await processWebhookBody(supabase, body);
    }

    return new NextResponse("EVENT_RECEIVED", { status: 200 });
  } catch (error) {
    console.error("WA Webhook Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
