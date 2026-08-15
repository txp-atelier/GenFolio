import { NextResponse } from "next/server";

import { backendFetch } from "@/lib/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const backendRes = await backendFetch(`/chat/sessions/${id}/messages`);
  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
