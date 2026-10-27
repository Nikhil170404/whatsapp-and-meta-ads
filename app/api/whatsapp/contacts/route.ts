import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { PRICING_PLANS } from "@/lib/pricing";
import { checkRateLimit } from "@/lib/rate-limit-middleware";
import { addContact } from "@/lib/api/ops";
import { respond } from "@/lib/api/http";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").replace(/[%,()]/g, " ").trim();
    const label = searchParams.get("label") || "";
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 100, 1), 1000);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

    const supabase = getSupabaseAdmin() as any;
    let query = supabase
      .from("wa_contacts")
      .select("*", { count: "exact" })
      .eq("user_id", session.id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("id")
      .range(offset, offset + limit - 1);

    if (label) query = query.contains("labels", [label]);
    if (search) query = query.or(`phone_number.ilike.%${search}%,display_name.ilike.%${search}%`);

    // Paged on purpose: the database never returns more than 1,000 rows at once, so asking
    // for "everything" silently returned only the first 1,000 contacts.
    const { data, error, count } = await query;
    if (error) throw error;
    return NextResponse.json({ contacts: data, total: count ?? data?.length ?? 0, limit, offset });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const rl = await checkRateLimit("api", `user:${session.id}`);
    if (!rl.success) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });

    const result = await addContact(getSupabaseAdmin() as any, session.id, {
      phone_number: body.phone_number,
      display_name: body.display_name,
      labels: body.labels,
      consent_confirmed: body.consent_confirmed === true,
      consent_purposes: body.consent_purposes,
      consent_source: body.consent_source === "import" ? "import" : "dashboard",
    });
    return respond(result, (contact) => ({ contact }));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkRateLimit("api", `user:${session.id}`);
    if (!rl.success) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get("ids");
    if (!idsParam) return NextResponse.json({ error: "ids query param required" }, { status: 400 });
    const ids = idsParam.split(",").map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) return NextResponse.json({ error: "No IDs provided" }, { status: 400 });

    const supabase = getSupabaseAdmin() as any;
    const { error } = await supabase
      .from("wa_contacts")
      .delete()
      .in("id", ids)
      .eq("user_id", session.id);

    if (error) throw error;
    return NextResponse.json({ success: true, deleted: ids.length });
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
