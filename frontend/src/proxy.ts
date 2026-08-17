import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  ACCESS_TOKEN_COOKIE,
  accessCookieOptions,
  REFRESH_TOKEN_COOKIE,
  refreshCookieOptions,
} from "@/lib/authCookies";
import { BACKEND_INTERNAL_URL } from "@/lib/config";

const PAGE_PREFIXES = ["/dashboard", "/tree", "/health", "/profile", "/add", "/search"];

function isPageRequest(pathname: string): boolean {
  return PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

async function tryRefresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const res = await fetch(`${BACKEND_INTERNAL_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token: string; refresh_token: string };
    return { accessToken: data.access_token, refreshToken: data.refresh_token };
  } catch {
    // Backend unreachable — fail open to "not refreshed" rather than
    // throwing out of proxy, which would break the request entirely.
    return null;
  }
}

/** The access-token cookie is set to expire at exactly the same moment the
 * JWT inside it does (see accessCookieOptions), so an active user gets
 * logged out mid-session the instant 30 minutes pass — even though the
 * refresh token (30 days) is still perfectly good. This silently renews the
 * session here, in front of every authenticated page and API route, so
 * activity never gets interrupted; only genuine inactivity past the refresh
 * token's own lifetime ends up back at /login. */
export async function proxy(request: NextRequest) {
  const hasAccessToken = request.cookies.has(ACCESS_TOKEN_COOKIE);
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!hasAccessToken && refreshToken) {
    const refreshed = await tryRefresh(refreshToken);
    if (refreshed) {
      // Forward the renewed cookies on THIS request too (not just the
      // response) so the Route Handler/Server Component this request is
      // headed to sees a valid session immediately, without needing a
      // second round-trip.
      const otherCookies = request.cookies
        .getAll()
        .filter((c) => c.name !== ACCESS_TOKEN_COOKIE && c.name !== REFRESH_TOKEN_COOKIE)
        .map((c) => `${c.name}=${c.value}`);
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set(
        "cookie",
        [
          ...otherCookies,
          `${ACCESS_TOKEN_COOKIE}=${refreshed.accessToken}`,
          `${REFRESH_TOKEN_COOKIE}=${refreshed.refreshToken}`,
        ].join("; ")
      );

      const response = NextResponse.next({ request: { headers: requestHeaders } });
      response.cookies.set(ACCESS_TOKEN_COOKIE, refreshed.accessToken, accessCookieOptions());
      response.cookies.set(REFRESH_TOKEN_COOKIE, refreshed.refreshToken, refreshCookieOptions());
      return response;
    }
  }

  if (!hasAccessToken && !refreshToken && isPageRequest(request.nextUrl.pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Either the access token is still valid, or there's no session at all
  // and this is an API route (not a page) — let it continue. API routes
  // fall through to backendFetch, which gets a 401 from FastAPI when
  // there's truly no usable session, and the client already has to handle
  // that case (e.g. TanStack Query error states).
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
    "/api/persons/:path*",
    "/api/health-records/:path*",
    "/api/chat/:path*",
    "/api/invitations",
  ],
};
