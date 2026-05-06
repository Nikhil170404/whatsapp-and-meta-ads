import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// CRITICAL: Session secret must be set in environment
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET environment variable must be set and be at least 32 characters");
}

const SECRET = new TextEncoder().encode(SESSION_SECRET);
const COOKIE_NAME = "replykaro_session";

// CRITICAL: Admin secret must be set for the admin dashboard
const ADMIN_SECRET = process.env.ADMIN_SECRET;
const ADMIN_JWT_SECRET = ADMIN_SECRET ? new TextEncoder().encode(ADMIN_SECRET) : null;
const ADMIN_COOKIE_NAME = "admin_token";

// Routes that require authentication
const protectedRoutes = ["/dashboard", "/wa", "/ads", "/keywords", "/analytics", "/settings"];

// Routes that should redirect to dashboard if authenticated
const authRoutes = ["/signin", "/signup"];
const isRootPath = (pathname: string) => pathname === "/";

async function getSessionFromRequest(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  // Capture referral code from ?ref= and store in cookie
  const refCode = request.nextUrl.searchParams.get("ref");
  if (refCode && /^[A-Z0-9]{6,12}$/i.test(refCode)) {
    const response = NextResponse.next();
    response.cookies.set("referral_code", refCode.toUpperCase(), {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
    return response;
  }

  const { pathname } = request.nextUrl;

  // --- 410 Legacy Handler (SEO Cleanup) ---
  const legacyPatterns = ["wishes", "carnival", "hogmanay", "greetings", "quotes"];
  if (legacyPatterns.some(pattern => pathname.toLowerCase().includes(pattern))) {
    return new NextResponse(null, {
      status: 410,
      statusText: "Gone",
    });
  }

  // Skip API routes for auth
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // --- Admin Route Protection ---
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    // Skip the login page and its auth endpoint
    if (pathname === "/admin/login" || pathname === "/api/admin/auth") {
      return NextResponse.next();
    }

    // Check for admin token
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!token || !ADMIN_JWT_SECRET) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    try {
      await jwtVerify(token, ADMIN_JWT_SECRET);
      return NextResponse.next();
    } catch {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Invalid admin token" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }
  // --- End Admin Protection ---

  // Get session
  const session = await getSessionFromRequest(request);

  // Check if route requires authentication
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // Redirect unauthenticated users from protected routes
  if (isProtectedRoute && !session) {
    const redirectUrl = new URL("/signin", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect authenticated users from auth routes or landing page to WA dashboard
  if (session && (isAuthRoute || isRootPath(pathname))) {
    return NextResponse.redirect(new URL("/wa", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
