import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";

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
    const { name, template_id, contact_ids } = body;

    if (!name || !template_id || !contact_ids?.length) {
      return NextResponse.json({ error: "Name, template, and contacts are required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin() as any;

    // For managed billing: verify wallet has enough for all recipients
    const { data: conn } = await supabase
      .from("wa_connections")
      .select("billing_type")
      .eq("user_id", session.id)
      .maybeSingle();
    if (conn?.billing_type === "managed") {
      const needed = contact_ids.length * 95;
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
          error: `Insufficient wallet balance. Need ₹${neededRupees} for ${contact_ids.length} recipients but only have ₹${balanceRupees}. Top up your wallet first.`,
          code: "INSUFFICIENT_BALANCE",
        }, { status: 402 });
      }
    }

    // Create broadcast
    const { data: broadcast, error: bcError } = await supabase
      .from("wa_broadcasts")
      .insert({
        user_id: session.id,
        name,
        template_id,
        status: "draft",
        total_recipients: contact_ids.length,
      })
      .select()
      .single();

    if (bcError) throw bcError;

    // Create recipient entries
    const recipients = contact_ids.map((cid: string) => ({
      broadcast_id: broadcast.id,
      contact_id: cid,
      status: "pending",
    }));

    const { error: recipError } = await supabase
      .from("wa_broadcast_recipients")
      .insert(recipients);

    if (recipError) throw recipError;

    return NextResponse.json({ broadcast });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
