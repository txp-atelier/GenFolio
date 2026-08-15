// Kept separate from lib/session.ts (which imports next/headers) so that
// proxy.ts — which runs in the Edge runtime and reads NextRequest.cookies
// directly — can share the cookie names without pulling in server-only APIs.
export const ACCESS_TOKEN_COOKIE = "ft_access_token";
export const REFRESH_TOKEN_COOKIE = "ft_refresh_token";
