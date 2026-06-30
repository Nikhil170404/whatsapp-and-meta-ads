import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { generateBundleCode } from "@/lib/cross-sell";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const code = generateBundleCode(session.id);
  return NextResponse.json({ code });
}
