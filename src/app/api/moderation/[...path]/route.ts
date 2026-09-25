import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

type Context = { params: Promise<{ path: string[] }> };

/**
 * BFF door for /v1/moderation (sanctions: warnings, timeouts, bans). Every call
 * needs the caller's access token, attached from the httpOnly cookie. Whether
 * that caller may do the thing is NOT decided here — ModerationService
 * re-reads their current role from the database and applies the rank rules;
 * this proxy is never the security boundary.
 */
async function proxy(req: NextRequest, { params }: Context) {
  const { path } = await params;
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ code: "missing_token", message: "Authentication required." }, { status: 401 });
  }

  const hasBody = req.method !== "GET" && req.method !== "DELETE";
  const payload = hasBody ? await req.json().catch(() => undefined) : undefined;

  const result = await callBackend(`/v1/moderation/${path.map(encodeURIComponent).join("/")}`, {
    method: req.method,
    body: payload,
    authToken: accessToken,
  });

  if (result.status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
}

export { proxy as GET, proxy as POST, proxy as DELETE };
