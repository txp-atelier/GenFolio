import { NextResponse } from "next/server";

import { BACKEND_INTERNAL_URL } from "@/lib/config";
import { setAuthCookies } from "@/lib/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json();

  const backendRes = await fetch(`${BACKEND_INTERNAL_URL}/invitations/${token}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!backendRes.ok) {
    const detail = await backendRes.json().catch(() => ({ detail: "Could not accept invite" }));
    return NextResponse.json(detail, { status: backendRes.status });
  }

  const tokens = (await backendRes.json()) as { access_token: string; refresh_token: string };
  await setAuthCookies(tokens.access_token, tokens.refresh_token);

  return NextResponse.json({ ok: true });
}
