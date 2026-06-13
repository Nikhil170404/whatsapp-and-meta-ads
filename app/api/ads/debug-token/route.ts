import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { env } from "@/lib/env";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin() as any;
  const { data: conn } = await supabase
    .from("ad_connections")
    .select("ad_account_id, page_id, access_token, page_access_token, status, updated_at")
    .eq("user_id", session.id)
    .single();

  if (!conn) return NextResponse.json({ error: "No ad_connections record found" }, { status: 404 });

  const appToken = `${env.NEXT_PUBLIC_FACEBOOK_APP_ID}|${env.FACEBOOK_APP_SECRET}`;

  const [userDebug, pageDebug] = await Promise.all([
    conn.access_token
      ? fetch(`https://graph.facebook.com/debug_token?input_token=${conn.access_token}&access_token=${appToken}`)
          .then((r) => r.json()).catch(() => null)
      : Promise.resolve(null),
    conn.page_access_token
      ? fetch(`https://graph.facebook.com/debug_token?input_token=${conn.page_access_token}&access_token=${appToken}`)
          .then((r) => r.json()).catch(() => null)
      : Promise.resolve(null),
  ]);

  return NextResponse.json({
    db: {
      status: conn.status,
      updated_at: conn.updated_at,
      ad_account_id: conn.ad_account_id,
      page_id: conn.page_id,
      access_token_length: conn.access_token?.length ?? 0,
      page_access_token_length: conn.page_access_token?.length ?? 0,
    },
    user_token_scopes: userDebug?.data?.scopes ?? userDebug?.error ?? "no token",
    user_token_valid: userDebug?.data?.is_valid ?? false,
    page_token_scopes: pageDebug?.data?.scopes ?? pageDebug?.error ?? "no token",
    page_token_valid: pageDebug?.data?.is_valid ?? false,
  });
}
