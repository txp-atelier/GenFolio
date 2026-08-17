import { NextResponse } from "next/server";

import { backendFetch } from "@/lib/session";

export async function GET(_request: Request, { params }: { params: Promise<{ personId: string }> }) {
  const { personId } = await params;
  const backendRes = await backendFetch(`/health-records/family/${personId}`);
  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
