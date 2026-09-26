import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; pageNumber: string }> }) {
  const { id, pageNumber } = await params;
  // A visitor without an account has no token: the backend then only issues pages of chapters that are not locked.
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const result = await callBackend(
    `/v1/chapters/${encodeURIComponent(id)}/pages/${encodeURIComponent(pageNumber)}/token`,
    { method: "POST", ...(accessToken ? { authToken: accessToken } : {}) }
  );
  return NextResponse.json(result.body, { status: result.status });
}
