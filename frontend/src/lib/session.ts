import "server-only";

import { cookies } from "next/headers";

import {
  ACCESS_TOKEN_COOKIE,
  accessCookieOptions,
  REFRESH_TOKEN_COOKIE,
  refreshCookieOptions,
} from "@/lib/authCookies";
import { BACKEND_INTERNAL_URL } from "@/lib/config";

export async function getAccessToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(ACCESS_TOKEN_COOKIE)?.value;
}

export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const store = await cookies();
  store.set(ACCESS_TOKEN_COOKIE, accessToken, accessCookieOptions());
  store.set(REFRESH_TOKEN_COOKIE, refreshToken, refreshCookieOptions());
}

export async function clearAuthCookies() {
  const store = await cookies();
  store.delete(ACCESS_TOKEN_COOKIE);
  store.delete(REFRESH_TOKEN_COOKIE);
}

/** Server-side fetch to FastAPI with the caller's access token attached. */
export async function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${BACKEND_INTERNAL_URL}${path}`, { ...init, headers, cache: "no-store" });
}
