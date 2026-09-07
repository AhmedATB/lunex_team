import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

/** Multipart passthrough — the browser's FormData is forwarded to the backend byte-for-byte, never buffered into JSON. */
export async function POST(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ code: "missing_token", message: "Authentication required." }, { status: 401 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ code: "invalid_body", message: "Invalid upload." }, { status: 400 });
  }

  const result = await callBackend("/v1/users/me/avatar", {
    method: "POST",
    body: formData,
    authToken: accessToken,
  });

  return NextResponse.json(result.body, { status: result.status });
}
