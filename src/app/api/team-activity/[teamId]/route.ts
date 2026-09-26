import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

type Context = { params: Promise<{ teamId: string }> };

/** BFF door for a team's activity log (its leaders and the site's team managers only; the backend checks). */
export async function GET(req: NextRequest, { params }: Context) {
  const { teamId } = await params;
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const result = await callBackend(`/v1/team-activity/${encodeURIComponent(teamId)}`, {
    method: "GET",
    ...(accessToken ? { authToken: accessToken } : {}),
  });
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
}
