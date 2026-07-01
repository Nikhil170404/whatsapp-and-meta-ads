import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { checkRateLimit } from "@/lib/rate-limit-middleware";

const FB_API = "https://graph.facebook.com/v25.0";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkRateLimit("analytics", `user:${session.id}`);
    if (!rl.success) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });

    const supabase = getSupabaseAdmin() as any;
    const { data: campaigns } = await supabase
      .from("ctwa_campaigns")
      .select("*")
      .eq("user_id", session.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ campaigns: campaigns ?? [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkRateLimit("auth", `user:${session.id}`);
    if (!rl.success) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });

    const { name, ad_text, headline, whatsapp_number, opening_message, daily_budget_inr, countries } = await req.json();

    if (!name?.trim() || !ad_text?.trim() || !headline?.trim() || !whatsapp_number?.trim() || !daily_budget_inr) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    const dailyBudgetPaise = Math.round(Number(daily_budget_inr) * 100);
    if (dailyBudgetPaise < 5700) {
      return NextResponse.json({ error: "Minimum daily budget is ₹57" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin() as any;

    const { data: conn } = await supabase
      .from("ad_connections")
      .select("ad_account_id, page_id, page_access_token, access_token")
      .eq("user_id", session.id)
      .single();

    if (!conn) return NextResponse.json({ error: "Meta Ads account not connected. Connect first." }, { status: 400 });
    if (!conn.page_id) return NextResponse.json({ error: "No Facebook Page linked. Reconnect your Meta account." }, { status: 400 });

    const { data: waConn } = await supabase
      .from("wa_connections")
      .select("phone_number_id")
      .eq("user_id", session.id)
      .eq("status", "active")
      .maybeSingle();

    const token = conn.access_token || conn.page_access_token;
    const waNum = whatsapp_number.replace(/\D/g, "");
    const openingMsg = opening_message?.trim() || "Hi, I saw your ad and I'm interested!";
    const targetCountries: string[] = countries?.length ? countries : ["IN"];
    const accountId = conn.ad_account_id.startsWith("act_") ? conn.ad_account_id : `act_${conn.ad_account_id}`;

    // ── Step 1: Campaign ──────────────────────────────────────────────────────
    const campaignRes = await fetch(`${FB_API}/${accountId}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        objective: "OUTCOME_ENGAGEMENT",
        status: "PAUSED",
        special_ad_categories: [],
        access_token: token,
      }),
    });
    const campaignJson = await campaignRes.json();
    if (campaignJson.error) {
      const e = campaignJson.error;
      console.error("Meta campaign error:", JSON.stringify(e));
      return NextResponse.json({
        error: `Campaign error (code ${e.code}/${e.error_subcode ?? ""}): ${e.message}`,
      }, { status: 400 });
    }
    const metaCampaignId: string = campaignJson.id;

    // ── Step 2: Ad Set ────────────────────────────────────────────────────────
    const adsetBody: Record<string, unknown> = {
      name: `${name} — Ad Set`,
      campaign_id: metaCampaignId,
      billing_event: "IMPRESSIONS",
      optimization_goal: "CONVERSATIONS",
      daily_budget: dailyBudgetPaise,
      targeting: {
        geo_locations: { countries: targetCountries },
        age_min: 18,
        age_max: 65,
      },
      destination_type: "WHATSAPP",
      status: "PAUSED",
      access_token: token,
    };
    if (waConn?.phone_number_id) {
      adsetBody.promoted_object = { whatsapp_phone_number_id: waConn.phone_number_id };
    }

    const adsetRes = await fetch(`${FB_API}/${accountId}/adsets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adsetBody),
    });
    const adsetJson = await adsetRes.json();
    if (adsetJson.error) {
      return NextResponse.json({ error: `Ad Set: ${adsetJson.error.message}` }, { status: 400 });
    }
    const metaAdsetId: string = adsetJson.id;

    // ── Step 3: Creative ──────────────────────────────────────────────────────
    const waLink = `https://wa.me/${waNum}?text=${encodeURIComponent(openingMsg)}`;
    const creativeRes = await fetch(`${FB_API}/${accountId}/adcreatives`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${name} — Creative`,
        object_story_spec: {
          page_id: conn.page_id,
          link_data: {
            message: ad_text,
            link: waLink,
            name: headline,
            call_to_action: {
              type: "WHATSAPP_MESSAGE",
              value: {
                app_destination: "WHATSAPP",
                whatsapp_number: waNum,
              },
            },
          },
        },
        access_token: token,
      }),
    });
    const creativeJson = await creativeRes.json();
    if (creativeJson.error) {
      return NextResponse.json({ error: `Creative: ${creativeJson.error.message}` }, { status: 400 });
    }
    const metaCreativeId: string = creativeJson.id;

    // ── Step 4: Ad ────────────────────────────────────────────────────────────
    const adRes = await fetch(`${FB_API}/${accountId}/ads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${name} — Ad`,
        adset_id: metaAdsetId,
        creative: { creative_id: metaCreativeId },
        status: "PAUSED",
        access_token: token,
      }),
    });
    const adJson = await adRes.json();
    if (adJson.error) {
      return NextResponse.json({ error: `Ad: ${adJson.error.message}` }, { status: 400 });
    }
    const metaAdId: string = adJson.id;

    // ── Save to DB ────────────────────────────────────────────────────────────
    const { data: campaign, error: dbErr } = await supabase
      .from("ctwa_campaigns")
      .insert({
        user_id: session.id,
        name,
        ad_text,
        headline,
        whatsapp_number: waNum,
        opening_message: openingMsg,
        daily_budget_inr: Number(daily_budget_inr),
        target_countries: targetCountries,
        meta_campaign_id: metaCampaignId,
        meta_adset_id: metaAdsetId,
        meta_creative_id: metaCreativeId,
        meta_ad_id: metaAdId,
        status: "paused",
      })
      .select()
      .single();

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

    return NextResponse.json({ campaign });
  } catch (error: any) {
    console.error("CTWA create error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkRateLimit("api", `user:${session.id}`);
    if (!rl.success) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });

    const { id, status } = await req.json();
    if (!id || !status) return NextResponse.json({ error: "Missing id or status" }, { status: 400 });

    const supabase = getSupabaseAdmin() as any;

    const { data: campaign } = await supabase
      .from("ctwa_campaigns")
      .select("meta_ad_id")
      .eq("id", id)
      .eq("user_id", session.id)
      .single();

    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: conn } = await supabase
      .from("ad_connections")
      .select("page_access_token, access_token")
      .eq("user_id", session.id)
      .single();

    if (!conn) return NextResponse.json({ error: "Not connected" }, { status: 400 });

    const token = conn.access_token || conn.page_access_token;

    const res = await fetch(`${FB_API}/${campaign.meta_ad_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: status === "active" ? "ACTIVE" : "PAUSED",
        access_token: token,
      }),
    });
    const json = await res.json();
    if (json.error) return NextResponse.json({ error: json.error.message }, { status: 400 });

    await supabase
      .from("ctwa_campaigns")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", session.id);

    return NextResponse.json({ success: true, status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkRateLimit("api", `user:${session.id}`);
    if (!rl.success) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const supabase = getSupabaseAdmin() as any;

    const { data: campaign } = await supabase
      .from("ctwa_campaigns")
      .select("meta_campaign_id")
      .eq("id", id)
      .eq("user_id", session.id)
      .single();

    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Best-effort delete from Meta (PAUSED campaigns can be deleted)
    const { data: conn } = await supabase
      .from("ad_connections")
      .select("page_access_token, access_token")
      .eq("user_id", session.id)
      .single();

    if (conn && campaign.meta_campaign_id) {
      const token = conn.access_token || conn.page_access_token;
      await fetch(`${FB_API}/${campaign.meta_campaign_id}`, {
        method: "DELETE",
        body: JSON.stringify({ access_token: token }),
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});
    }

    await supabase.from("ctwa_campaigns").delete().eq("id", id).eq("user_id", session.id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
