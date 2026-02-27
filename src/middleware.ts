import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

const PROTECTED_PATTERNS = ["/board", "/settings", "/task"];
const AUTH_PATTERNS = ["/login", "/register"];

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PATTERNS.some(
    (pattern) => pathname === pattern || pathname.startsWith(`${pattern}/`)
  );
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_PATTERNS.some((pattern) => pathname === pattern);
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join("; ")
  );
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get session via better-auth
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  // Auth guard: redirect unauthenticated users on protected routes
  if (isProtectedRoute(pathname) && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return addSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  // Auth redirect: redirect authenticated users away from login/register
  if (isAuthRoute(pathname) && session) {
    return addSecurityHeaders(
      NextResponse.redirect(new URL("/board", request.url))
    );
  }

  // Add security headers to all other responses
  const response = NextResponse.next();
  return addSecurityHeaders(response);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public directory files (images, fonts, etc.)
     * - API routes (handled separately by better-auth)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)",
  ],
};
