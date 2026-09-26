import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";

/** "I forgot my password". The answer is the same for every address; `available: false` only means the site has no mail provider yet. */
export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ code: "invalid_body", message: "Invalid request body." }, { status: 400 });
  }

  const result = await callBackend<{ available: boolean }>("/v1/auth/forgot-password", {
    method: "POST",
    body: payload,
    forwardedHeaders: {
      "x-device-fingerprint": req.headers.get("x-device-fingerprint") ?? undefined,
      "x-pow-solution": req.headers.get("x-pow-solution") ?? undefined,
      "x-turnstile-token": req.headers.get("x-turnstile-token") ?? undefined,
    },
  });
  return NextResponse.json(result.body, { status: result.status });
}
