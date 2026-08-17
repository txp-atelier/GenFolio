import { NextResponse } from "next/server";

import { backendFetch } from "@/lib/session";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  const backendRes = await backendFetch(`/health-records/search?q=${encodeURIComponent(q)}`);
  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
