import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

export const dynamic = "force-dynamic";

/** The lock settings in force and their limits, for the owner. The backend re-checks the caller's role from the database. */
export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return NextResponse.json({ code: "missing_token", message: "Authentication required." }, { status: 401 });

  const result = await callBackend("/v1/admin/wallet/settings", { authToken: accessToken });
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
}

/** Changes any of the lock settings. Owner and super administrator only, checked by the backend. */
export async function PUT(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return NextResponse.json({ code: "missing_token", message: "Authentication required." }, { status: 401 });
  const payload = await req.json().catch(() => null);
  if (!payload) return NextResponse.json({ code: "invalid_body", message: "Invalid request body." }, { status: 400 });

  const result = await callBackend("/v1/admin/wallet/settings", { method: "PUT", body: payload, authToken: accessToken });
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
}
