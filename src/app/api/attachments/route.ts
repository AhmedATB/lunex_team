import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

/** Multipart passthrough — the picture goes to the backend as it came, and comes back as an id to attach to a comment or message. */
export async function POST(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return NextResponse.json({ code: "missing_token", message: "Authentication required." }, { status: 401 });

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ code: "invalid_body", message: "Invalid upload." }, { status: 400 });

  const result = await callBackend("/v1/attachments", { method: "POST", body: formData, authToken: accessToken });
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
}
