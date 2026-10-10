import { NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";

export const dynamic = "force-dynamic";

/** Which chapters are locked (the number of newest ones and the free first ones), for everyone including visitors. */
export async function GET() {
  const result = await callBackend("/v1/wallet/rule");
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
