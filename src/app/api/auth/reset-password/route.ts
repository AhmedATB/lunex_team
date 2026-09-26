import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";

/** Sets the new password with the token from the mailed link. Success is 204/no body; the person then signs in normally. */
export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ code: "invalid_body", message: "Invalid request body." }, { status: 400 });
  }

  const result = await callBackend("/v1/auth/reset-password", { method: "POST", body: payload });
  if (result.ok) return new NextResponse(null, { status: 204 });
  return NextResponse.json(result.body, { status: result.status });
}
