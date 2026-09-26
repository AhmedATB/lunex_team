import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

type Context = { params: Promise<{ path?: string[] }> };

/**
 * BFF door for /v1/collaboration: a team asking another for help, the answer, and ending a collaboration. Every route needs the
 * member's session; the backend decides against the account's role in the teams who may do what.
 */
async function proxy(req: NextRequest, { params }: Context) {
  const { path = [] } = await params;
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const hasBody = req.method !== "GET" && req.method !== "DELETE";
  const body = hasBody ? await req.json().catch(() => undefined) : undefined;

  const suffix = path.length > 0 ? `/${path.map(encodeURIComponent).join("/")}` : "";
  const result = await callBackend(`/v1/collaboration${suffix}${req.nextUrl.search}`, {
    method: req.method,
    body,
    ...(accessToken ? { authToken: accessToken } : {}),
  });
  if (result.status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE };
