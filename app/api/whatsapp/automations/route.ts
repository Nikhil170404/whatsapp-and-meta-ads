import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { PRICING_PLANS } from "@/lib/pricing";

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
    const { name, trigger_keyword, trigger_type, reply_message } = body;

    if (!name || !reply_message) {
      return NextResponse.json({ error: "Name and reply message are required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin() as any;

    const planKey = (session.plan_type?.toUpperCase() || "FREE") as keyof typeof PRICING_PLANS;
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
        reply_message,
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
    const { id, is_active, name, trigger_type, trigger_keyword, reply_message } = body;

    if (!id) {
      return NextResponse.json({ error: "Automation ID is required" }, { status: 400 });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (typeof is_active === "boolean") updates.is_active = is_active;
    if (name !== undefined) updates.name = name;
    if (trigger_type !== undefined) updates.trigger_type = trigger_type;
    if (trigger_keyword !== undefined) updates.trigger_keyword = trigger_keyword;
    if (reply_message !== undefined) updates.reply_message = reply_message;

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
