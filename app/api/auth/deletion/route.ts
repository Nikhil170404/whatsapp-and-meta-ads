import { NextResponse } from "next/server";
import crypto from "crypto";
import { checkRateLimit } from "@/lib/rate-limit-middleware";

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

        // Verify Facebook's signed_request: HMAC-SHA256 of the payload string,
        // compared as raw bytes against the base64url-decoded signature.
        const expectedSig = crypto.createHmac("sha256", secret).update(payload).digest();
        const providedSig = Buffer.from(encoded_sig.replace(/-/g, "+").replace(/_/g, "/"), "base64");
        if (
            expectedSig.length !== providedSig.length ||
            !crypto.timingSafeEqual(expectedSig, providedSig)
        ) {
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }

        // Decode data only after the signature is confirmed valid
        const data = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
        const userId = data.user_id;
        console.log(`Data deletion request received for user: ${userId}`);

        // Generate a tracking confirmation code
        const confirmation_code = `del-${userId}-${Date.now()}`;
        const status_url = `https://www.replykaro.in/deletion-status?id=${confirmation_code}`;

        return NextResponse.json({
            url: status_url,
            confirmation_code: confirmation_code,
        });
    } catch (error) {
        console.error("Deletion callback error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
