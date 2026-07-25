import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { checkRateLimit } from "@/lib/rate-limit-middleware";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin() as any;
    const { data, error } = await supabase
      .from("wa_broadcasts")
      .select("*")
      .eq("user_id", session.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ broadcasts: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, template_id, contact_ids, scheduled_at } = body;

    if (!name || !template_id || !contact_ids?.length) {
      return NextResponse.json({ error: "Name, template, and contacts are required" }, { status: 400 });
    }

    const rl = await checkRateLimit("api", `user:${session.id}`);
    if (!rl.success) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });

    const supabase = getSupabaseAdmin() as any;

    // Always read plan_type fresh from DB — JWT is stale for up to 7 days
    const { data: currentUser } = await supabase.from("users").select("plan_type").eq("id", session.id).single();
    const planKey = (currentUser?.plan_type?.toUpperCase() || "FREE");
    if (planKey === "FREE" || planKey === "EXPIRED") {
      return NextResponse.json({
        error: "Broadcasts require a paid plan. Upgrade to Growth or Pro to send bulk messages.",
        code: "PLAN_REQUIRED",
      }, { status: 403 });
    }

    // Verify the template and every contact belong to this user, so a caller
    // can't broadcast to (or through) another user's data by passing foreign IDs.
    const { data: ownedTemplate } = await supabase
      .from("wa_templates")
      .select("id")
      .eq("id", template_id)
      .eq("user_id", session.id)
      .maybeSingle();
    if (!ownedTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const uniqueContactIds: string[] = Array.from(new Set(contact_ids));
    const { data: ownedContacts } = await supabase
      .from("wa_contacts")
      .select("id")
      .eq("user_id", session.id)
      .in("id", uniqueContactIds);
    const ownedIds = new Set((ownedContacts ?? []).map((c: any) => c.id));
    if (ownedIds.size !== uniqueContactIds.length) {
      return NextResponse.json({ error: "One or more contacts are invalid" }, { status: 400 });
    }

    // For managed billing: verify wallet has enough for all recipients
    const { data: conn } = await supabase
      .from("wa_connections")
      .select("billing_type")
      .eq("user_id", session.id)
      .maybeSingle();
    if (conn?.billing_type === "managed") {
      const needed = uniqueContactIds.length * 95;
      const { data: wallet } = await supabase
        .from("wa_wallet")
        .select("balance_paise")
        .eq("user_id", session.id)
        .maybeSingle();
      const balance = wallet?.balance_paise || 0;
      if (balance < needed) {
        const neededRupees = (needed / 100).toFixed(2);
        const balanceRupees = (balance / 100).toFixed(2);
        return NextResponse.json({
          error: `Insufficient wallet balance. Need ₹${neededRupees} for ${uniqueContactIds.length} recipients but only have ₹${balanceRupees}. Top up your wallet first.`,
          code: "INSUFFICIENT_BALANCE",
        }, { status: 402 });
      }
    }

    // Create broadcast
    const isScheduled = scheduled_at && new Date(scheduled_at) > new Date();
    const { data: broadcast, error: bcError } = await supabase
      .from("wa_broadcasts")
      .insert({
        user_id: session.id,
        name,
        template_id,
        status: isScheduled ? "scheduled" : "draft",
        scheduled_at: scheduled_at || null,
        total_recipients: uniqueContactIds.length,
      })
      .select()
      .single();

    if (bcError) throw bcError;

    // Create recipient entries
    const recipients = uniqueContactIds.map((cid: string) => ({
      broadcast_id: broadcast.id,
      contact_id: cid,
      status: "pending",
    }));

    const { error: recipError } = await supabase
      .from("wa_broadcast_recipients")
      .insert(recipients);

    if (recipError) throw recipError;

    return NextResponse.json({ broadcast, scheduled: !!isScheduled });
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
    if (!id) return NextResponse.json({ error: "Broadcast ID is required" }, { status: 400 });

    const supabase = getSupabaseAdmin() as any;
    const { error } = await supabase
      .from("wa_broadcasts")
      .delete()
      .eq("id", id)
      .eq("user_id", session.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
