import { NextRequest, NextResponse } from "next/server";
import type { BackendAuthResponse, BackendErrorBody } from "@/lib/auth-types";
import { callBackend } from "@/lib/backend-client";
import { setSessionCookies } from "@/lib/session-cookies";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ code: "invalid_body", message: "Invalid request body." }, { status: 400 });
  }

  const result = await callBackend<BackendAuthResponse & BackendErrorBody>("/v1/auth/register", {
    method: "POST",
    body: payload,
    forwardedHeaders: {
      "x-device-fingerprint": req.headers.get("x-device-fingerprint") ?? undefined,
      "x-pow-solution": req.headers.get("x-pow-solution") ?? undefined,
    },
  });

  if (!result.ok) {
    return NextResponse.json(result.body, { status: result.status });
  }

  // Tokens live in this response ONLY long enough to become httpOnly
  // cookies — they are never included in the JSON body sent to the browser.
  const response = NextResponse.json({ user: result.body.user }, { status: result.status });
  setSessionCookies(response, result.body);
  return response;
}
