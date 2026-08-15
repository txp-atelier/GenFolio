import { NextResponse } from "next/server";

import { backendFetch } from "@/lib/session";

export async function PATCH(request: Request) {
  const body = await request.json();

  const backendRes = await backendFetch("/persons/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
