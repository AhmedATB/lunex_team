import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

/** Makes a chapter's featured picture from one of its own pages (`{ pageNumber }`). The backend checks who may. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ code: "missing_token", message: "Authentication required." }, { status: 401 });
  }
  const payload = await req.json().catch(() => undefined);
  const result = await callBackend(`/v1/chapters/${encodeURIComponent(id)}/thumbnail/page`, { method: "PUT", body: payload, authToken: accessToken });
  return NextResponse.json(result.body, { status: result.status });
}
