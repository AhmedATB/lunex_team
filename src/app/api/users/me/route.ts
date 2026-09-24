import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE, clearSessionCookies } from "@/lib/session-cookies";

/** A user editing their own username/displayName/bio — actor identity comes from their own access token, never from the request body. */
export async function PATCH(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ code: "missing_token", message: "Authentication required." }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ code: "invalid_body", message: "Invalid request body." }, { status: 400 });
  }

  const result = await callBackend("/v1/users/me", {
    method: "PATCH",
    body: payload,
    authToken: accessToken,
  });

  return NextResponse.json(result.body, { status: result.status });
}

/**
 * Permanently deletes the caller's own account. The body carries the
 * confirmation (password, or the retyped username for a Discord/Google-only
 * account) and is verified server-side. On success the browser's session
 * cookies are cleared here in the same response — the refresh token has
 * already been deleted with the account, so they'd be dead weight anyway.
 */
export async function DELETE(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ code: "missing_token", message: "Authentication required." }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ code: "invalid_body", message: "Invalid request body." }, { status: 400 });
  }

  const result = await callBackend("/v1/users/me", {
    method: "DELETE",
    body: payload,
    authToken: accessToken,
  });

  if (result.ok) {
    const response = new NextResponse(null, { status: 204 });
    clearSessionCookies(response);
    return response;
  }
  return NextResponse.json(result.body, { status: result.status });
}
