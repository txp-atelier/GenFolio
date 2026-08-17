import { NextResponse } from "next/server";

import { backendFetch } from "@/lib/session";

export async function GET() {
  const backendRes = await backendFetch("/health-records/compare");
  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
