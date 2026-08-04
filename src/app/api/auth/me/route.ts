import { NextRequest, NextResponse } from "next/server";
import type { BackendPublicUser } from "@/lib/auth-types";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

/** On-demand identity check for client components (e.g. after an action that might have changed the session). Server Components should prefer getServerSession() directly instead of fetching this over HTTP. */
export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return NextResponse.json(null, { status: 200 });

  const result = await callBackend<BackendPublicUser>("/v1/auth/me", { authToken: accessToken });
  if (!result.ok) return NextResponse.json(null, { status: 200 });
  return NextResponse.json(result.body, { status: 200 });
}
