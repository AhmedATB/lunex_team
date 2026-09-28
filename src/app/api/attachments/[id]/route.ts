import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend-client";
import { identityHeaders } from "@/lib/backend-identity";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

/**
 * A picture of a comment or chat message — a binary passthrough, so it cannot go through `callBackend` (which reads JSON). The
 * visitor's own token goes with the request when there is one: the backend decides from where the picture belongs (a comment: anyone;
 * a chat: its people) whether this visitor may have it, and says how long a shared cache may keep it.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const size = req.nextUrl.searchParams.get("size") === "thumb" ? "?size=thumb" : "";

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/v1/attachments/${encodeURIComponent(id)}${size}`, {
      cache: "no-store",
      headers: { ...(await identityHeaders()), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    });
  } catch {
    return NextResponse.json({ code: "backend_unreachable", message: "Could not reach the backend." }, { status: 503 });
  }
  if (!res.ok) return NextResponse.json({ code: "image_not_found", message: "This picture does not exist." }, { status: res.status === 429 ? 429 : 404 });

  return new NextResponse(await res.arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "image/webp",
      "Cache-Control": res.headers.get("Cache-Control") ?? "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
