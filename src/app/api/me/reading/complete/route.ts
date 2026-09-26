import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

/** The reader reached the end of a chapter. The server decides whether it earns experience; nothing here is trusted. */
export async function POST(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return NextResponse.json({ code: "missing_token", message: "Authentication required." }, { status: 401 });

  const payload = await req.json().catch(() => null);
  if (!payload) return NextResponse.json({ code: "invalid_body", message: "Invalid request body." }, { status: 400 });

  const result = await callBackend("/v1/me/reading/complete", { method: "POST", body: payload, authToken: accessToken });
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
}
