import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { checkRateLimit } from "@/lib/rate-limit-middleware";
import { createTemplate } from "@/lib/api/ops";
import { respond } from "@/lib/api/http";
import {
  buildAuthComponents, buildMetaComponents, defaultExamples, toMetaName, validateTemplate,
  type TemplateInput,
} from "@/lib/whatsapp/template-builder";

const WA_API_URL = "https://graph.facebook.com/v25.0";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkRateLimit("analytics", `user:${session.id}`);
    if (!rl.success) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });

    const supabase = getSupabaseAdmin() as any;

    // Also sync approved templates from Meta
    const { data: conn } = await supabase
      .from("wa_connections")
      .select("waba_id, access_token")
      .eq("user_id", session.id)
      .maybeSingle();

    if (conn?.waba_id && conn?.access_token) {
      try {
        const metaRes = await fetch(`${WA_API_URL}/${conn.waba_id}/message_templates?fields=name,status,category,language,components,rejected_reason&limit=100`, {
          headers: { Authorization: `Bearer ${conn.access_token}` },
        });
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          for (const t of metaData.data || []) {
            const bodyComp = t.components?.find((c: any) => c.type === "BODY");
            await supabase.from("wa_templates").upsert({
              user_id: session.id,
              name: t.name,
              category: t.category,
              language: t.language,
              body_text: bodyComp?.text || null,
              template_type: t.category === "AUTHENTICATION" ? "otp" : "standard",
              status: t.status?.toLowerCase() === "approved" ? "approved" : t.status?.toLowerCase() || "pending",
              rejection_reason: t.status?.toLowerCase() === "rejected" && t.rejected_reason && t.rejected_reason !== "NONE" ? t.rejected_reason : null,
              meta_template_id: t.id || null,
            }, { onConflict: "user_id,name" });
          }
        }
      } catch { /* ignore sync errors */ }
    }

    const { data, error } = await supabase
      .from("wa_templates")
      .select("*")
      .eq("user_id", session.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ templates: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkRateLimit("api", `user:${session.id}`);
    if (!rl.success) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });

    const body = await req.json();
    const result = await createTemplate(getSupabaseAdmin() as any, session.id, body);
    return respond(result, (r) => ({ template: r.template, meta_error: r.meta_error }));
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
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Template ID is required" }, { status: 400 });

    const supabase = getSupabaseAdmin() as any;

    // Also delete from Meta if we have the meta_template_id
    const { data: tpl } = await supabase
      .from("wa_templates")
      .select("meta_template_id, name")
      .eq("id", id)
      .eq("user_id", session.id)
      .single();

    if (!tpl) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    const { data: conn } = await supabase
      .from("wa_connections")
      .select("waba_id, access_token")
      .eq("user_id", session.id)
      .maybeSingle();

    if (conn?.waba_id && conn?.access_token && tpl.name) {
      try {
        await fetch(`${WA_API_URL}/${conn.waba_id}/message_templates?name=${encodeURIComponent(tpl.name)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${conn.access_token}` },
        });
      } catch { /* non-fatal — still delete locally */ }
    }

    const { error } = await supabase
      .from("wa_templates")
      .delete()
      .eq("id", id)
      .eq("user_id", session.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

