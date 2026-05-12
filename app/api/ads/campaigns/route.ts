import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin() as any;
    const { data, error } = await supabase
      .from("ad_campaigns")
      .select("*")
      .eq("user_id", session.id)
      .order("synced_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ campaigns: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin() as any;

    // Get the user's ad connection
    const { data: connection } = await supabase
      .from("ad_connections")
      .select("*")
      .eq("user_id", session.id)
      .single();

    if (!connection) {
      return NextResponse.json({ error: "No Meta Ads account connected" }, { status: 400 });
    }

    const { ad_account_id, access_token } = connection;

    // Fetch campaigns from Meta Graph API
    const url = `https://graph.facebook.com/v21.0/${ad_account_id}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,insights{spend,impressions,clicks,ctr}&access_token=${access_token}`;
    const res = await fetch(url);
    const apiData = await res.json();

    if (apiData.error) {
      return NextResponse.json({ error: apiData.error.message }, { status: 400 });
    }

    const campaigns = apiData.data || [];

    // Upsert campaigns
    for (const camp of campaigns) {
      const insight = camp.insights?.data?.[0] || {};
      await supabase.from("ad_campaigns").upsert(
        {
          user_id: session.id,
          campaign_id: camp.id,
          name: camp.name,
          status: camp.status,
          objective: camp.objective,
          spend: parseFloat(insight.spend || "0"),
          impressions: parseInt(insight.impressions || "0"),
          clicks: parseInt(insight.clicks || "0"),
          ctr: parseFloat(insight.ctr || "0"),
          synced_at: new Date().toISOString(),
        },
        { onConflict: "user_id,campaign_id" }
      );
    }

    return NextResponse.json({ synced: campaigns.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
