import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { PRICING_PLANS } from "@/lib/pricing";
import { checkRateLimit } from "@/lib/rate-limit-middleware";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin() as any;
    const { data, error } = await supabase
      .from("wa_automations")
      .select("*")
      .eq("user_id", session.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ automations: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, trigger_keyword, trigger_type, reply_message, message_type, media_url, button_options } = body;

    if (!name) {
      return NextResponse.json({ error: "Automation name is required" }, { status: 400 });
    }
    const msgType = message_type || "text";
    if (msgType === "text" && !reply_message) {
      return NextResponse.json({ error: "Reply message is required for text automations" }, { status: 400 });
    }
    if ((msgType === "image" || msgType === "video" || msgType === "document") && !media_url) {
      return NextResponse.json({ error: "Media URL is required for image/video/document automations" }, { status: 400 });
    }
    if (msgType === "buttons") {
      if (!reply_message) return NextResponse.json({ error: "Body text is required for button messages" }, { status: 400 });
      const btns = button_options?.buttons ?? [];
      if (!btns.length) return NextResponse.json({ error: "Add at least one button (max 3)" }, { status: 400 });
      if (btns.length > 3) return NextResponse.json({ error: "Maximum 3 buttons allowed by Meta" }, { status: 400 });
    }

    const rl = await checkRateLimit("automations", `user:${session.id}`);
    if (!rl.success) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });

    const supabase = getSupabaseAdmin() as any;

    // Fetch fresh plan_type from DB so plan upgrades take effect without re-login
    const { data: currentUser } = await supabase.from("users").select("plan_type").eq("id", session.id).single();
    const planKey = (currentUser?.plan_type?.toUpperCase() || "FREE") as keyof typeof PRICING_PLANS;
    const limit = PRICING_PLANS[planKey]?.limits?.automations ?? PRICING_PLANS.FREE.limits.automations;
    const { count } = await supabase
      .from("wa_automations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.id);
    if ((count || 0) >= limit) {
      return NextResponse.json({ error: `Automation limit reached (${limit} on your plan). Upgrade to create more.` }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("wa_automations")
      .insert({
        user_id: session.id,
        name,
        trigger_keyword: trigger_keyword || null,
        trigger_type: trigger_type || "keyword",
        reply_message: reply_message || null,
        message_type: msgType,
        media_url: media_url || null,
        button_options: button_options || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ automation: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, is_active, name, trigger_type, trigger_keyword, reply_message, message_type, media_url, button_options } = body;

    if (!id) {
      return NextResponse.json({ error: "Automation ID is required" }, { status: 400 });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (typeof is_active === "boolean") updates.is_active = is_active;
    if (name !== undefined) updates.name = name;
    if (trigger_type !== undefined) updates.trigger_type = trigger_type;
    if (trigger_keyword !== undefined) updates.trigger_keyword = trigger_keyword;
    if (reply_message !== undefined) updates.reply_message = reply_message;
    if (message_type !== undefined) updates.message_type = message_type;
    if (media_url !== undefined) updates.media_url = media_url;
    if (button_options !== undefined) updates.button_options = button_options;

    const supabase = getSupabaseAdmin() as any;
    const { data, error } = await supabase
      .from("wa_automations")
      .update(updates)
      .eq("id", id)
      .eq("user_id", session.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ automation: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Automation ID is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin() as any;
    const { error } = await supabase
      .from("wa_automations")
      .delete()
      .eq("id", id)
      .eq("user_id", session.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
