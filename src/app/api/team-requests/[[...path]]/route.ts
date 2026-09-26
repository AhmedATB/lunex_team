import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

type Context = { params: Promise<{ path?: string[] }> };

/**
 * BFF door for /v1/team-requests: a member's request to open a team (send, list their own, resend after changes were asked
 * for) and the team managers' review of all of them. Every route needs the member's session; the backend decides who may
 * do what against the account's current role.
 *
 * Optional catch-all so the bare `/api/team-requests` (send, and the managers' list) is served too.
 */
async function proxy(req: NextRequest, { params }: Context) {
  const { path = [] } = await params;
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const hasBody = req.method !== "GET" && req.method !== "DELETE";
  const body = hasBody ? await req.json().catch(() => undefined) : undefined;

  const suffix = path.length > 0 ? `/${path.map(encodeURIComponent).join("/")}` : "";
  const result = await callBackend(`/v1/team-requests${suffix}${req.nextUrl.search}`, {
    method: req.method,
    body,
    ...(accessToken ? { authToken: accessToken } : {}),
  });
  if (result.status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH };
