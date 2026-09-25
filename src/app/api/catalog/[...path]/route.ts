import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

type Context = { params: Promise<{ path: string[] }> };

const IMAGE_ENDPOINT = /^(series\/[^/]+\/(cover|banner)|teams\/[^/]+\/logo|news\/[^/]+\/cover)$/;

/**
 * BFF door for /v1/catalog: the public catalogue reads, the pictures, and the
 * editorial writes (series, teams, tags, news, uploads) plus the owner's
 * import. Three shapes pass through:
 *  - pictures (`.../cover`, `.../banner`, `.../logo`): raw bytes, cached hard —
 *    the URLs carry a version stamp, so a replaced picture arrives under a new one;
 *  - multipart uploads: the browser's FormData forwarded untouched;
 *  - everything else: JSON.
 * The access token rides from the httpOnly cookie when there is one. Who may
 * write is decided by the backend against the account's current role.
 */
async function proxy(req: NextRequest, { params }: Context) {
  const { path } = await params;
  const joined = path.map(encodeURIComponent).join("/");
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  if (req.method === "GET" && IMAGE_ENDPOINT.test(path.join("/"))) {
    let res: Response;
    try {
      res = await fetch(`${BACKEND_URL}/v1/catalog/${joined}`, { cache: "no-store" });
    } catch {
      return NextResponse.json({ code: "backend_unreachable", message: "Could not reach the backend." }, { status: 503 });
    }
    if (!res.ok) return new NextResponse(null, { status: res.status });
    return new NextResponse(await res.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  const contentType = req.headers.get("content-type") ?? "";
  const isMultipart = contentType.startsWith("multipart/form-data");
  const hasBody = req.method !== "GET" && req.method !== "DELETE";
  const body = !hasBody ? undefined : isMultipart ? await req.formData().catch(() => undefined) : await req.json().catch(() => undefined);

  const result = await callBackend(`/v1/catalog/${joined}${req.nextUrl.search}`, {
    method: req.method,
    body,
    authToken: accessToken,
  });

  if (result.status === 204) return new NextResponse(null, { status: 204 });
  // The owner's import/storage tools are account-bound, never shareable.
  const isPublicRead = req.method === "GET" && path[0] !== "import";
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": isPublicRead ? "public, max-age=15, stale-while-revalidate=60" : "private, no-store" },
  });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
