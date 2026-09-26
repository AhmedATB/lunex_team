import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

export const dynamic = "force-dynamic";

/** The signed-in reader's own level, experience, streak and achievements. Only ever describes the caller, from their own token. */
export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return NextResponse.json({ code: "missing_token", message: "Authentication required." }, { status: 401 });

  const result = await callBackend("/v1/me/progress", { authToken: accessToken });
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
}
