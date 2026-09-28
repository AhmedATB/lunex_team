import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, callBackend } from "@/lib/backend-client";
import { identityHeaders } from "@/lib/backend-identity";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

type Context = { params: Promise<{ id: string }> };

const needsSession = () => NextResponse.json({ code: "missing_token", message: "Authentication required." }, { status: 401 });

/** The picture of a group, for its members: a binary passthrough with the member's own session (the backend checks they belong to it). */
export async function GET(req: NextRequest, { params }: Context) {
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return needsSession();
  const { id } = await params;

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/v1/conversations/${encodeURIComponent(id)}/photo`, {
      cache: "no-store",
      headers: { ...(await identityHeaders()), Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return NextResponse.json({ code: "backend_unreachable", message: "Could not reach the backend." }, { status: 503 });
  }
  if (!res.ok) return NextResponse.json({ code: "image_not_found", message: "This group has no picture." }, { status: 404 });

  return new NextResponse(await res.arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "image/webp",
      // The address carries the picture's version, so a changed picture is a new address and this one never goes stale.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** A new picture for the group, chosen from the device (multipart, forwarded as it came). */
export async function PUT(req: NextRequest, { params }: Context) {
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return needsSession();
  const { id } = await params;
  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ code: "invalid_body", message: "Invalid upload." }, { status: 400 });

  const result = await callBackend(`/v1/conversations/${encodeURIComponent(id)}/photo`, { method: "PUT", body: formData, authToken: accessToken });
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(req: NextRequest, { params }: Context) {
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return needsSession();
  const { id } = await params;
  const result = await callBackend(`/v1/conversations/${encodeURIComponent(id)}/photo`, { method: "DELETE", authToken: accessToken });
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
}
