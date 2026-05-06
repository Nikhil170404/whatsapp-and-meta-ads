import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";

    const supabase = getSupabaseAdmin() as any;
    let query = supabase
      .from("wa_contacts")
      .select("*")
      .eq("user_id", session.id)
      .order("last_message_at", { ascending: false });

    if (search) {
      query = query.or(`phone_number.ilike.%${search}%,display_name.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ contacts: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { phone_number, display_name, labels } = body;

    if (!phone_number) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin() as any;
    const { data, error } = await supabase
      .from("wa_contacts")
      .upsert({
        user_id: session.id,
        phone_number,
        display_name: display_name || null,
        labels: labels || [],
      }, { onConflict: "user_id,phone_number" })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ contact: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, display_name, labels } = body;

    if (!id) {
      return NextResponse.json({ error: "Contact ID is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin() as any;
    const updates: any = {};
    if (display_name !== undefined) updates.display_name = display_name;
    if (labels !== undefined) updates.labels = labels;

    const { data, error } = await supabase
      .from("wa_contacts")
      .update(updates)
      .eq("id", id)
      .eq("user_id", session.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ contact: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
