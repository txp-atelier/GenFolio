import { NextResponse } from "next/server";

import { backendFetch } from "@/lib/session";

export async function GET() {
  const backendRes = await backendFetch("/health-report-files");
  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}

export async function POST(request: Request) {
  // Forward the incoming multipart/form-data body as-is — backendFetch
  // won't set a Content-Type header for FormData, so fetch() fills in the
  // correct multipart boundary itself.
  const formData = await request.formData();

  const backendRes = await backendFetch("/health-report-files", {
    method: "POST",
    body: formData,
  });

  const data = await backendRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: backendRes.status });
}
