import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend-client";

/**
 * Raw binary passthrough (can't use callBackend, which always calls
 * res.json()) — the response body is opaque encrypted bundle bytes, not
 * JSON. No cookie/session check here: the short-lived, signed, device-
 * bound, single-use token in the query string IS the authorization, fully
 * verified server-side by ImagesService.streamAsset. This route exists
 * only so the browser never calls the backend's own origin directly (§00
 * of the architecture doc) — everything it does is forward bytes untouched.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const token = req.nextUrl.searchParams.get("token");

  let res: Response;
  try {
    res = await fetch(
      `${BACKEND_URL}/v1/images/${encodeURIComponent(assetId)}/stream?token=${encodeURIComponent(token ?? "")}`,
      { cache: "no-store" }
    );
  } catch {
    return NextResponse.json({ code: "backend_unreachable", message: "Could not reach the backend." }, { status: 503 });
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ code: "image_stream_error", message: "Could not fetch this page." }));
    return NextResponse.json(body, { status: res.status });
  }

  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/octet-stream" },
  });
}
