import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { PRICING_PLANS } from "@/lib/pricing";
import { checkRateLimit } from "@/lib/rate-limit-middleware";
import { createAutomation } from "@/lib/api/ops";
import { respond } from "@/lib/api/http";

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

    const rl = await checkRateLimit("automations", `user:${session.id}`);
    if (!rl.success) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });

    const result = await createAutomation(getSupabaseAdmin() as any, session.id, await req.json());
    return respond(result, (automation) => ({ automation }));
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
