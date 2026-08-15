import { NextResponse } from "next/server";

import { backendFetch } from "@/lib/session";

export async function POST(request: Request) {
  const body = await request.json();

  const backendRes = await backendFetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
