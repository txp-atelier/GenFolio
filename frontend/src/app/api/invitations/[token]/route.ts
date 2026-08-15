import { NextResponse } from "next/server";

import { BACKEND_INTERNAL_URL } from "@/lib/config";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const backendRes = await fetch(`${BACKEND_INTERNAL_URL}/invitations/${token}`, {
    cache: "no-store",
  });

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
