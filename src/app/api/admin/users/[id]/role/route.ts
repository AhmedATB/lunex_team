import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ code: "missing_token", message: "Authentication required." }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ code: "invalid_body", message: "Invalid request body." }, { status: 400 });
  }

  // Authorization is NOT checked here — this route just forwards the caller's
  // own access token. UsersService on the backend independently re-verifies
  // the actor's current role from the database before allowing anything;
  // that's the real security boundary, not this proxy.
  const result = await callBackend(`/v1/users/${encodeURIComponent(id)}/role`, {
    method: "PATCH",
    body: payload,
    authToken: accessToken,
  });

  return NextResponse.json(result.body, { status: result.status });
}
