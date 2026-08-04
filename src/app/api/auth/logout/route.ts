import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { clearSessionCookies, REFRESH_TOKEN_COOKIE } from "@/lib/session-cookies";

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (refreshToken) {
    // Best-effort: revoke server-side even if this fails, cookies are
    // cleared below regardless — the user's browser is logged out either way.
    await callBackend("/v1/auth/logout", {
      method: "POST",
      body: { refreshToken },
      forwardedHeaders: { "x-device-fingerprint": req.headers.get("x-device-fingerprint") ?? undefined },
    }).catch(() => null);
  }

  const response = new NextResponse(null, { status: 204 });
  clearSessionCookies(response);
  return response;
}
