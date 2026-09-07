import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

/** Public list (by seriesId) — the backend route is @Public(), no cookie required. */
export async function GET(req: NextRequest) {
  const seriesId = req.nextUrl.searchParams.get("seriesId");
  const qs = seriesId ? `?seriesId=${encodeURIComponent(seriesId)}` : "";
  const result = await callBackend(`/v1/chapters${qs}`);
  return NextResponse.json(result.body, { status: result.status });
}

/** Creating a chapter is a privileged action — real auth required. */
export async function POST(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ code: "missing_token", message: "Authentication required." }, { status: 401 });
  }
  const payload = await req.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ code: "invalid_body", message: "Invalid request body." }, { status: 400 });
  }
  const result = await callBackend("/v1/chapters", { method: "POST", body: payload, authToken: accessToken });
  return NextResponse.json(result.body, { status: result.status });
}
