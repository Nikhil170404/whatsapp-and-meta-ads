import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { getSupabaseAdmin } from "@/lib/supabase/client";

const sessionSecret = process.env.SESSION_SECRET || (process.env.NODE_ENV === "production" ? "" : "temporary_secret_for_build_purposes_only_32_chars");

const SECRET = new TextEncoder().encode(sessionSecret || "temporary_secret_for_build_purposes_only_32_chars");
const COOKIE_NAME = "replykaro_session";

export interface SessionUser {
  id: string;
  facebook_user_id: string;
  display_name: string;
  plan_type: "free" | "starter" | "pro" | "expired";
  profile_picture_url?: string;
  created_at: string;
  email?: string | null;
}

export async function createSession(user: any): Promise<string> {
  const token = await new SignJWT({
    id: user.id,
    facebook_user_id: user.facebook_user_id,
    display_name: user.display_name,
    plan_type: user.plan_type,
    profile_picture_url: user.profile_picture_url,
    created_at: user.created_at,
    email: user.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET);

  return token;
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}
