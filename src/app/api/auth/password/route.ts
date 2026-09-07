import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

/** Changing your own password — still requires the current one (enforced server-side, see AuthService.changePassword). Success is 204/no body, same as logout. */
export async function PATCH(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ code: "missing_token", message: "Authentication required." }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ code: "invalid_body", message: "Invalid request body." }, { status: 400 });
  }

  const result = await callBackend("/v1/auth/password", {
    method: "PATCH",
    body: payload,
    authToken: accessToken,
  });

  if (result.ok) {
    return new NextResponse(null, { status: 204 });
  }
  return NextResponse.json(result.body, { status: result.status });
}
