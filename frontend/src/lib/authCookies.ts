// Kept separate from lib/session.ts (which imports next/headers) so that
// proxy.ts — which reads/writes NextRequest/NextResponse cookies directly —
// can share the cookie names and options without pulling in server-only
// APIs. (Next.js 16 runs proxy.ts on the Node.js runtime by default, but
// this module stays framework-context-agnostic regardless.)
export const ACCESS_TOKEN_COOKIE = "gf_access_token";
export const REFRESH_TOKEN_COOKIE = "gf_refresh_token";

// Mirrors the backend's ACCESS_TOKEN_EXPIRE_MINUTES / REFRESH_TOKEN_EXPIRE_DAYS
// (backend/app/core/config.py) — keep both pairs in sync if either changes.
export const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 30;
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const isProduction = process.env.NODE_ENV === "production";

type CookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
};

export function accessCookieOptions(): CookieOptions {
  return { httpOnly: true, secure: isProduction, sameSite: "lax", path: "/", maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS };
}

export function refreshCookieOptions(): CookieOptions {
  return { httpOnly: true, secure: isProduction, sameSite: "lax", path: "/", maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS };
}
