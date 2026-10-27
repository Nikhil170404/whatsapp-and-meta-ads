import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { checkRateLimit } from "@/lib/rate-limit-middleware";
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
    const { name, category, language, body_text, header_text, footer_text, buttons, examples, template_type, expiry_minutes } = body;

    const isOtp = template_type === "otp";
    const input: TemplateInput = {
      name: String(name ?? ""),
      category: isOtp ? "AUTHENTICATION" : (["MARKETING", "UTILITY"].includes(category) ? category : "UTILITY"),
      language: language || "en_US",
      header_text: header_text || undefined,
      body_text: String(body_text ?? ""),
      footer_text: footer_text || undefined,
      buttons: Array.isArray(buttons) ? buttons : [],
      examples: Array.isArray(examples) ? examples.map(String) : defaultExamples(String(body_text ?? "")),
    };

    // Same checks the editor shows, enforced again on the server.
    const problems = validateTemplate(input).filter((i) => i.level === "error");
    if (problems.length) {
      return NextResponse.json({ error: problems[0].message, issues: problems }, { status: 400 });
    }

    const supabase = getSupabaseAdmin() as any;

    // Template creation requires STARTER or PRO — read fresh from DB (JWT is stale)
    const { data: currentUser } = await supabase.from("users").select("plan_type").eq("id", session.id).single();
    const planKey = (currentUser?.plan_type?.toUpperCase() || "FREE");
    if (planKey === "FREE" || planKey === "EXPIRED") {
      return NextResponse.json({
        error: "Message templates require a paid plan. Upgrade to Growth or Pro to create and submit templates to Meta.",
        code: "PLAN_REQUIRED",
      }, { status: 403 });
    }

    // Template names must be lowercase with underscores for Meta
    const metaName = toMetaName(input.name);

    // Save to DB first
    const { data, error } = await supabase
      .from("wa_templates")
      .upsert({
        user_id: session.id,
        name: metaName,
        category: input.category,
        language: input.language,
        template_type: isOtp ? "otp" : "standard",
        body_text: isOtp ? null : input.body_text,
        header_text: input.header_text ?? null,
        footer_text: input.footer_text ?? null,
        buttons: input.buttons?.length ? input.buttons : null,
        examples: input.examples ?? null,
        rejection_reason: null,
        status: "pending",
      }, { onConflict: "user_id,name" })
      .select()
      .single();

    if (error) throw error;

    // Submit to Meta for approval
    const { data: conn } = await supabase
      .from("wa_connections")
      .select("waba_id, access_token")
      .eq("user_id", session.id)
      .maybeSingle();

    let metaError: string | null = null;
    if (conn?.waba_id && conn?.access_token) {
      try {
        const metaRes = await fetch(`${WA_API_URL}/${conn.waba_id}/message_templates`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${conn.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: metaName,
            category: input.category,
            language: input.language,
            components: isOtp
              ? buildAuthComponents({ expiry_minutes: Number(expiry_minutes) || 10 })
              : buildMetaComponents(input),
          }),
        });
        const metaData = await metaRes.json();
        if (metaData.id) {
          await supabase
            .from("wa_templates")
            .update({ meta_template_id: metaData.id, status: "pending" })
            .eq("id", data.id);
          data.meta_template_id = metaData.id;
        } else {
          metaError = metaData.error?.message || "Meta rejected the template";
        }
      } catch (err: any) {
        metaError = err.message;
      }
    } else {
      metaError = "WhatsApp not connected — template saved locally only";
    }

    return NextResponse.json({ template: data, meta_error: metaError });
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

