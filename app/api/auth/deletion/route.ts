import { NextResponse } from "next/server";
import crypto from "crypto";
import { checkRateLimit } from "@/lib/rate-limit-middleware";
import { getSupabaseAdmin } from "@/lib/supabase/client";

export async function POST(req: Request) {
    try {
        const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        const rl = await checkRateLimit("auth", `deletion:${ip}`);
        if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

        const formData = await req.formData();
        const signed_request = formData.get("signed_request") as string;

        if (!signed_request) {
            return NextResponse.json({ error: "Missing signed_request" }, { status: 400 });
        }

        const [encoded_sig, payload] = signed_request.split(".");
        const secret = process.env.FACEBOOK_APP_SECRET;
        if (!secret) {
            console.error("FACEBOOK_APP_SECRET not configured for deletion callback");
            return NextResponse.json({ error: "Server not configured" }, { status: 500 });
        }
        if (!encoded_sig || !payload) {
            return NextResponse.json({ error: "Malformed signed_request" }, { status: 400 });
        }

        // Verify Facebook's signed_request signature before touching any data
        const expectedSig = crypto.createHmac("sha256", secret).update(payload).digest();
        const providedSig = Buffer.from(encoded_sig.replace(/-/g, "+").replace(/_/g, "/"), "base64");
        if (
            expectedSig.length !== providedSig.length ||
            !crypto.timingSafeEqual(expectedSig, providedSig)
        ) {
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }

        const data = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
        const facebookUserId = data.user_id;
        console.log(`Data deletion request received for Facebook user: ${facebookUserId}`);

        // Find the user by their Facebook user ID (stored during OAuth)
        const supabase = getSupabaseAdmin() as any;
        const { data: user } = await supabase
            .from("users")
            .select("id")
            .eq("facebook_user_id", facebookUserId)
            .maybeSingle();

        if (user?.id) {
            const userId = user.id;
            // Delete all user data in dependency order (children before parents)
            await supabase.from("wa_wallet_transactions").delete().eq("user_id", userId);
            await supabase.from("wa_wallet").delete().eq("user_id", userId);
            await supabase.from("wa_broadcast_recipients").delete().in(
                "broadcast_id",
                supabase.from("wa_broadcasts").select("id").eq("user_id", userId)
            );
            await supabase.from("wa_broadcasts").delete().eq("user_id", userId);
            await supabase.from("wa_messages").delete().eq("user_id", userId);
            await supabase.from("wa_automations").delete().eq("user_id", userId);
            await supabase.from("wa_templates").delete().eq("user_id", userId);
            await supabase.from("wa_contacts").delete().eq("user_id", userId);
            await supabase.from("wa_api_keys").delete().eq("user_id", userId);
            await supabase.from("wa_connections").delete().eq("user_id", userId);
            await supabase.from("wa_usage").delete().eq("user_id", userId);
            await supabase.from("users").delete().eq("id", userId);
            console.log(`All data deleted for user ${userId} (Facebook user ${facebookUserId})`);
        } else {
            console.log(`No local account found for Facebook user ${facebookUserId} — nothing to delete`);
        }

        const confirmation_code = `del-${facebookUserId}-${Date.now()}`;
        const status_url = `${process.env.APP_URL || "https://replykaro.in"}/deletion-status?id=${confirmation_code}`;

        return NextResponse.json({
            url: status_url,
            confirmation_code: confirmation_code,
        });
    } catch (error) {
        console.error("Deletion callback error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
