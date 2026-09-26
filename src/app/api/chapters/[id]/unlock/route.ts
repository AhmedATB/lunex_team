import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

/** Opens a locked chapter by spending a reading credit or coins (`{ method: "credit" | "coins" }`); the server decides if it is allowed. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ code: "missing_token", message: "Authentication required." }, { status: 401 });
  }
  const payload = await req.json().catch(() => null);
  if (!payload) return NextResponse.json({ code: "invalid_body", message: "Invalid request body." }, { status: 400 });

  const result = await callBackend(`/v1/chapters/${encodeURIComponent(id)}/unlock`, { method: "POST", body: payload, authToken: accessToken });
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
}
