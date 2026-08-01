// Protects every /admin route. Runs before any /admin page or API
// route — no page-level auth checks needed elsewhere, one place to
// audit. Login page itself (/admin/login) is explicitly excluded, or
// nobody could ever log in.

import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authed = verifySessionCookieValue(cookie);

  if (!authed) {
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    const loginUrl = new URL("/admin/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
