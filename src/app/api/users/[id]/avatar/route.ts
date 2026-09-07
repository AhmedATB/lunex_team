import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend-client";

/**
 * A binary passthrough, not JSON — can't reuse callBackend (which always
 * calls res.json()). Public and unauthenticated on purpose: an avatar is as
 * visible as any other public-profile detail, viewable by anyone whether
 * logged in or not (matches the backend's own @Public() on this route).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/v1/users/${encodeURIComponent(id)}/avatar`, { cache: "no-store" });
  } catch {
    return NextResponse.json({ code: "backend_unreachable", message: "Could not reach the backend." }, { status: 503 });
  }

  if (!res.ok) {
    return NextResponse.json({ code: "avatar_not_found", message: "No avatar set for this user." }, { status: res.status });
  }

  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
