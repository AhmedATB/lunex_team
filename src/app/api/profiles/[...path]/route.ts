import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

type Context = { params: Promise<{ path: string[] }> };

/**
 * One BFF door for the whole /v1/profiles surface: profile pages, the privacy
 * settings, and the signed-in library (favorites + reading history). The
 * access token comes from the httpOnly cookie and is attached here — the
 * browser never holds it — and the backend does the real authorization per
 * route, so this only decides whether a token is REQUIRED: every `me/...`
 * path needs one, while a public profile is fetched with the viewer's token
 * when there is one (that is how "members only" sections know who is asking).
 *
 * Nothing here is cacheable: what a profile shows depends on who is looking.
 */
async function proxy(req: NextRequest, { params }: Context) {
  const { path } = await params;
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  if (path[0] === "me" && !accessToken) {
    return NextResponse.json({ code: "missing_token", message: "Authentication required." }, { status: 401 });
  }

  const hasBody = req.method !== "GET" && req.method !== "DELETE";
  const payload = hasBody ? await req.json().catch(() => undefined) : undefined;

  const result = await callBackend(`/v1/profiles/${path.map(encodeURIComponent).join("/")}`, {
    method: req.method,
    body: payload,
    authToken: accessToken,
  });

  if (result.status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
