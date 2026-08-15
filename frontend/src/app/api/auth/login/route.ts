import { NextResponse } from "next/server";

import { BACKEND_INTERNAL_URL } from "@/lib/config";
import { setAuthCookies } from "@/lib/session";

export async function POST(request: Request) {
  const body = await request.json();

  const backendRes = await fetch(`${BACKEND_INTERNAL_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!backendRes.ok) {
    const detail = await backendRes.json().catch(() => ({ detail: "Login failed" }));
    return NextResponse.json(detail, { status: backendRes.status });
  }

  const tokens = (await backendRes.json()) as { access_token: string; refresh_token: string };
  await setAuthCookies(tokens.access_token, tokens.refresh_token);

  return NextResponse.json({ ok: true });
}
