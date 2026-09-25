import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

type Context = { params: Promise<{ path?: string[] }> };

/**
 * BFF door for /v1/comments: the series thread (`GET /api/comments?seriesId=`),
 * the home page's latest comments, posting, editing, deleting, reacting and
 * reporting. The access token rides along from the httpOnly cookie when there
 * is one — reading works without it, but with it every comment also carries the
 * viewer's own reaction. Writes are rejected by the backend without a token;
 * who may do what (author vs staff, muted, banned, rate limits) is decided
 * there, never here.
 *
 * Optional catch-all so the bare `/api/comments` (the list) is served too.
 */
async function proxy(req: NextRequest, { params }: Context) {
  const { path = [] } = await params;
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  const hasBody = req.method !== "GET" && req.method !== "DELETE";
  const payload = hasBody ? await req.json().catch(() => undefined) : undefined;

  const suffix = path.length > 0 ? `/${path.map(encodeURIComponent).join("/")}` : "";
  const result = await callBackend(`/v1/comments${suffix}${req.nextUrl.search}`, {
    method: req.method,
    body: payload,
    authToken: accessToken,
  });

  if (result.status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
