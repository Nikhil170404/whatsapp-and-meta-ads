import { getSupabaseAdmin } from "@/lib/supabase/client";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit-middleware";

const WA_API_URL = "https://graph.facebook.com/v25.0";

export async function POST(req: Request) {
  try {
    // Auth via Bearer token (API key)
    const authHeader = req.headers.get("authorization") || "";
    const apiKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!apiKey || !apiKey.startsWith("rk_live_")) {
      return NextResponse.json({ error: "Missing or invalid API key. Use Authorization: Bearer rk_live_..." }, { status: 401 });
    }

    const rl = await checkRateLimit("api", `key:${apiKey}`);
    if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded. Max 100 requests/min." }, { status: 429 });

    const supabase = getSupabaseAdmin() as any;

    // Look up user by API key
    const { data: keyRow } = await supabase
      .from("wa_api_keys")
      .select("user_id")
      .eq("api_key", apiKey)
      .single();

    if (!keyRow) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });

    // Update last_used_at (fire-and-forget, non-blocking)
    supabase.from("wa_api_keys").update({ last_used_at: new Date().toISOString() }).eq("api_key", apiKey).then(() => {});

    // Get WA connection for this user
    const { data: conn } = await supabase
      .from("wa_connections")
      .select("phone_number_id, access_token, status")
      .eq("user_id", keyRow.user_id)
      .eq("status", "active")
      .single();

    if (!conn) return NextResponse.json({ error: "No active WhatsApp connection found for this API key." }, { status: 400 });

    const body = await req.json();
    const { phone, template, params, type, text } = body;

    if (!phone) return NextResponse.json({ error: "Missing required field: phone" }, { status: 400 });

    // Normalize phone (add + if missing)
    const to = phone.startsWith("+") ? phone : `+${phone}`;

    let payload: Record<string, unknown>;

    if (type === "text" || (!template?.trim() && text)) {
      // Simple text message
      if (!text) return NextResponse.json({ error: "Missing required field: text" }, { status: 400 });
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: text },
      };
    } else {
      // Template message
      if (!template) return NextResponse.json({ error: "Missing required field: template (or use type:'text' with text field)" }, { status: 400 });

      const components: Record<string, unknown>[] = [];
      if (params && Array.isArray(params) && params.length > 0) {
        components.push({
          type: "body",
          parameters: params.map((p: string) => ({ type: "text", text: String(p) })),
        });
      }

      payload = {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: template,
          language: { code: body.language || "en_US" },
          ...(components.length > 0 ? { components } : {}),
        },
      };
    }

    const waRes = await fetch(`${WA_API_URL}/${conn.phone_number_id}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${conn.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const waData = await waRes.json();
    if (!waRes.ok) {
      return NextResponse.json({ error: "WhatsApp API error", details: waData?.error }, { status: 502 });
    }

    return NextResponse.json({ success: true, message_id: waData?.messages?.[0]?.id });
  } catch (err: any) {
    console.error("v1/send error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
