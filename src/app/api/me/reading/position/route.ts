import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

export const dynamic = "force-dynamic";

/** Where to resume one chapter — asked when its page opens. */
export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return NextResponse.json({ code: "missing_token", message: "Authentication required." }, { status: 401 });

  const chapterId = req.nextUrl.searchParams.get("chapterId");
  if (!chapterId) return NextResponse.json({ code: "missing_chapter_id", message: "chapterId is required." }, { status: 400 });

  const result = await callBackend(`/v1/me/reading/position?chapterId=${encodeURIComponent(chapterId)}`, { authToken: accessToken });
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
}

/** A ping, every so often, of where the reader has scrolled to. Fire-and-forget on the caller's side. */
export async function PUT(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return NextResponse.json({ code: "missing_token", message: "Authentication required." }, { status: 401 });

  const payload = await req.json().catch(() => null);
  if (!payload) return NextResponse.json({ code: "invalid_body", message: "Invalid request body." }, { status: 400 });

  const result = await callBackend("/v1/me/reading/position", { method: "PUT", body: payload, authToken: accessToken });
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
}
