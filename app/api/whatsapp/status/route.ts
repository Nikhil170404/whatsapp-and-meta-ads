import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { parseMessagingTier } from "@/lib/whatsapp/messaging-limits";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ connected: false }, { status: 401 });

  const supabase = getSupabaseAdmin() as any;
  const { data } = await supabase
    .from("wa_connections")
    .select(
      "status, quality_rating, messaging_tier, messaging_limit_tier, quality_paused_at, token_expires_at, token_refresh_failed_at, last_error, last_error_at, daily_unique_sent, daily_sent_reset_at"
    )
    .eq("user_id", session.id)
    .single();

  if (!data) return NextResponse.json({ connected: false });

  const isConnected = data.status === "active";
  const tokenExpiresAt = data.token_expires_at
    ? new Date(data.token_expires_at)
    : null;
  const now = new Date();
  const daysUntilExpiry = tokenExpiresAt
    ? Math.floor((tokenExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const limit = parseMessagingTier(data.messaging_limit_tier);

  return NextResponse.json({
    connected: isConnected,
    status: data.status,
    qualityRating: data.quality_rating ?? "UNKNOWN",
    messagingTier: data.messaging_tier ?? 1,
    // Real allowance from Meta, plus a ready-to-render label.
    messagingLimitTier: limit.tier,
    dailyLimit: Number.isFinite(limit.dailyLimit) ? limit.dailyLimit : null,
    dailyLimitLabel: limit.label,
    qualityPaused: !!data.quality_paused_at,
    tokenExpiresAt: data.token_expires_at,
    daysUntilExpiry,
    tokenNeedsAttention:
      data.token_refresh_failed_at !== null ||
      (daysUntilExpiry !== null && daysUntilExpiry < 7),
    lastError: data.last_error,
    lastErrorAt: data.last_error_at,
    dailyUniqueSent: data.daily_unique_sent ?? 0,
    dailySentResetAt: data.daily_sent_reset_at,
  });
}
