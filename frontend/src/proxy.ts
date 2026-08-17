import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ACCESS_TOKEN_COOKIE } from "@/lib/authCookies";

export function proxy(request: NextRequest) {
  if (!request.cookies.has(ACCESS_TOKEN_COOKIE)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/tree/:path*",
    "/health/:path*",
    "/profile/:path*",
    "/add/:path*",
    "/search/:path*",
  ],
};
