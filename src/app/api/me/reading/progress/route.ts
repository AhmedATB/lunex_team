import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

export const dynamic = "force-dynamic";

/** Every chapter of one work the reader has touched — what the chapter list's checkmarks and progress bars come from. */
export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return NextResponse.json({ code: "missing_token", message: "Authentication required." }, { status: 401 });

  const seriesId = req.nextUrl.searchParams.get("seriesId");
  if (!seriesId) return NextResponse.json({ code: "missing_series_id", message: "seriesId is required." }, { status: 400 });

  const result = await callBackend(`/v1/me/reading/progress?seriesId=${encodeURIComponent(seriesId)}`, { authToken: accessToken });
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
}
