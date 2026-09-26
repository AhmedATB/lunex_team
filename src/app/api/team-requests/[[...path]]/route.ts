import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, callBackend } from "@/lib/backend-client";
import { identityHeaders } from "@/lib/backend-identity";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

type Context = { params: Promise<{ path?: string[] }> };

/**
 * BFF door for /v1/team-requests: a member's request to open a team (send, list their own, resend after changes were asked
 * for) and the team managers' review of all of them. Every route needs the member's session; the backend decides who may
 * do what against the account's current role.
 *
 * Optional catch-all so the bare `/api/team-requests` (send, and the managers' list) is served too. Besides JSON it carries the
 * requester's logo: uploaded from their device as multipart, and read back as raw bytes (only for the requester and the managers).
 */
async function proxy(req: NextRequest, { params }: Context) {
  const { path = [] } = await params;
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  if (req.method === "GET" && path.length === 2 && path[1] === "logo") {
    let res: Response;
    try {
      res = await fetch(`${BACKEND_URL}/v1/team-requests/${encodeURIComponent(path[0])}/logo`, {
        cache: "no-store",
        headers: { ...(await identityHeaders()), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      });
    } catch {
      return NextResponse.json({ code: "backend_unreachable", message: "Could not reach the backend." }, { status: 503 });
    }
    if (!res.ok) return new NextResponse(null, { status: res.status });
    return new NextResponse(await res.arrayBuffer(), {
      status: 200,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "image/webp", "Cache-Control": "private, max-age=31536000, immutable" },
    });
  }

  const isMultipart = (req.headers.get("content-type") ?? "").startsWith("multipart/form-data");
  const hasBody = req.method !== "GET" && req.method !== "DELETE";
  const body = !hasBody ? undefined : isMultipart ? await req.formData().catch(() => undefined) : await req.json().catch(() => undefined);

  const suffix = path.length > 0 ? `/${path.map(encodeURIComponent).join("/")}` : "";
  const result = await callBackend(`/v1/team-requests${suffix}${req.nextUrl.search}`, {
    method: req.method,
    body,
    ...(accessToken ? { authToken: accessToken } : {}),
  });
  if (result.status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
