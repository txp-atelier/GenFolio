import { NextResponse } from "next/server";

import { BACKEND_INTERNAL_URL } from "@/lib/config";

export async function POST(request: Request) {
  const body = await request.json();

  const backendRes = await fetch(`${BACKEND_INTERNAL_URL}/auth/password-reset/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!backendRes.ok) {
    const detail = await backendRes.json().catch(() => ({ detail: "Reset failed" }));
    return NextResponse.json(detail, { status: backendRes.status });
  }

  return NextResponse.json({ ok: true });
}
