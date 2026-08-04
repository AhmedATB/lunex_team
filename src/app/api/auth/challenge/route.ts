import { NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";

export async function GET() {
  const result = await callBackend<{ nonce: string; difficulty: number; expiresIn: number }>(
    "/v1/security/challenge"
  );
  return NextResponse.json(result.body, { status: result.status });
}
