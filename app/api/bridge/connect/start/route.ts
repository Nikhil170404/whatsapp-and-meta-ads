import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { AFTER_LOGIN_COOKIE, connectPath, isValidCode, trustedOrigin } from "@/lib/bridge/connect";

/**
 * Where "Connect WhatsApp" on replykaro.com sends the person. Signed in: straight to the connect page.
 * Not signed in: remember the connect page, send them to sign up or sign in, and the login brings them back to it.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const from = req.nextUrl.searchParams.get("from");
  const base = req.nextUrl.origin;
  if (!isValidCode(code) || !trustedOrigin(from)) {
    return NextResponse.redirect(`${base}/signin?error=${encodeURIComponent("This connect link is not valid. Start again from ReplyKaro Unified.")}`);
  }
  const path = connectPath(code, from!);
  if (await getSession()) return NextResponse.redirect(`${base}${path}`);
  const res = NextResponse.redirect(`${base}/signin`);
  res.cookies.set(AFTER_LOGIN_COOKIE, path, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 15 * 60, path: "/" });
  return res;
}
