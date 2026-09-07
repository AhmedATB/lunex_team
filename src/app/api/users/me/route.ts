import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

/** A user editing their own username/displayName/bio — actor identity comes from their own access token, never from the request body. */
export async function PATCH(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ code: "missing_token", message: "Authentication required." }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ code: "invalid_body", message: "Invalid request body." }, { status: 400 });
  }

  const result = await callBackend("/v1/users/me", {
    method: "PATCH",
    body: payload,
    authToken: accessToken,
  });

  return NextResponse.json(result.body, { status: result.status });
}
