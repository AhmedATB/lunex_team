import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

/** Data-portability download — everything the platform stores about the caller, as one JSON file. Identity comes from the access token only; `no-store` keeps the copy out of any shared cache. */
export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ code: "missing_token", message: "Authentication required." }, { status: 401 });
  }

  const result = await callBackend<{ account?: { username?: string } }>("/v1/users/me/export", { authToken: accessToken });
  if (!result.ok) {
    return NextResponse.json(result.body, { status: result.status });
  }

  const username = (result.body?.account?.username ?? "account").replace(/[^a-zA-Z0-9_-]/g, "");
  return NextResponse.json(result.body, {
    headers: {
      "Content-Disposition": `attachment; filename="lunex-data-${username}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
