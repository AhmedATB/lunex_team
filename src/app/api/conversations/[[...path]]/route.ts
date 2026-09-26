import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

type Context = { params: Promise<{ path?: string[] }> };

/**
 * BFF door for /v1/conversations: the member's chats, one chat's messages, sending, marking read, adding people to a group
 * and leaving. Every call needs the member's session; who may see which conversation is decided by the backend.
 */
async function proxy(req: NextRequest, { params }: Context) {
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ code: "missing_token", message: "Authentication required." }, { status: 401 });
  }

  const { path = [] } = await params;
  const hasBody = req.method !== "GET" && req.method !== "DELETE";
  const payload = hasBody ? await req.json().catch(() => undefined) : undefined;
  const suffix = path.length > 0 ? `/${path.map(encodeURIComponent).join("/")}` : "";

  const result = await callBackend(`/v1/conversations${suffix}${req.nextUrl.search}`, { method: req.method, body: payload, authToken: accessToken });
  if (result.status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
}

export { proxy as GET, proxy as POST, proxy as DELETE };
