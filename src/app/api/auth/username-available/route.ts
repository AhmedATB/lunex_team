import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";

/** "Is this username free?" for the sign-up form. Open to visitors (it sits under /api/auth, which the sign-in gate leaves alone). */
export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username") ?? "";
  const result = await callBackend<{ available: boolean; reason?: "invalid" | "reserved" | "taken" }>(
    `/v1/auth/username-available?username=${encodeURIComponent(username)}`
  );
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
