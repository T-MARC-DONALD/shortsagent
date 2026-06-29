import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy — runs on every request.
 * Adds cache-busting headers to all /api/ responses to prevent CDN/gateway
 * caching issues (like 412 Precondition Failed from stale If-Match headers).
 *
 * In Next.js 16, middleware.ts was renamed to proxy.ts and the exported
 * function must be named `proxy` (not `middleware`).
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only apply to API routes
  if (pathname.startsWith("/api/")) {
    const response = NextResponse.next();

    // Prevent caching entirely — every request should hit the server
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    response.headers.set("Surrogate-Control", "no-store");

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
