import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "@/lib/supabase/types";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";

// CRITICAL: Session secret must be set in environment
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET environment variable must be set and be at least 32 characters");
}

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET);

const COOKIE_NAME = "replykaro_session";

export interface SessionUser {
  id: string;
  instagram_user_id: string;
  instagram_username: string;
  plan_type: "free" | "starter" | "pro" | "expired";
  profile_picture_url?: string;
  created_at: string;
  plan_expires_at?: string;
  subscription_status?: string;
  email?: string | null;
}

export async function createSession(user: User): Promise<string> {
  const token = await new SignJWT({
    id: user.id,
    instagram_user_id: user.instagram_user_id,
    instagram_username: user.instagram_username,
    plan_type: user.plan_type,
    profile_picture_url: user.profile_picture_url,
    created_at: user.created_at,
    plan_expires_at: user.plan_expires_at,
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
    const sessionUser = payload as unknown as SessionUser;

    // Create a mutable copy
    const updatedSessionUser: SessionUser = { ...sessionUser };

    // P1 Fix: Fetch fresh plan details from DB with Caching (Scale Fix)
    const cacheKey = `session_user:${sessionUser.id}`;

    try {
      // @ts-ignore
      const { Redis: redisInstance } = await import("../redis") as any;
      const redis = redisInstance;

      // Try cache
      const cached = await (redis as any).get(cacheKey);
      if (cached) return cached as SessionUser;

      const supabase = getSupabaseAdmin();

      const { data: user } = await supabase
        .from("users")
        .select("plan_type, plan_expires_at, subscription_status, email")
        .eq("id", sessionUser.id)
        .single() as any;

      if (user) {
        // Override JWT data with fresh DB data
        updatedSessionUser.plan_type = user.plan_type as any;
        updatedSessionUser.plan_expires_at = user.plan_expires_at;
        updatedSessionUser.subscription_status = user.subscription_status;
        updatedSessionUser.email = user.email;

        // Cache for 5 minutes
        await redis.set(cacheKey, updatedSessionUser, { ex: 300 });
      }
    } catch (err) {
      // Fallback to JWT data if Redis/DB fails
      logger.error("Error refreshing session data", { userId: sessionUser.id, category: "auth" }, err as Error);
    }

    return updatedSessionUser;
  } catch {
    return null;
  }
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  // 2.2: Invalidate session cache BEFORE deleting cookie
  if (token) {
    try {
      const { payload } = await jwtVerify(token, SECRET);
      const userId = (payload as any)?.id;
      if (userId) {
        const { invalidateSessionCache } = await import("@/lib/auth/cache");
        await invalidateSessionCache(userId);
      }
    } catch {
      // JWT may be expired/invalid — that's fine, just clean up cookie
    }
  }

  cookieStore.delete(COOKIE_NAME);
}
