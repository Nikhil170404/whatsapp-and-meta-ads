import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit-middleware";

export async function GET(req: Request) {
    try {
        const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        const rl = await checkRateLimit("api", `session:${ip}`);
        if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

        const user = await getSession();
        return NextResponse.json({ user });
    } catch (error) {
        return NextResponse.json({ user: null }, { status: 200 });
    }
}
