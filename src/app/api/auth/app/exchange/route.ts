import { NextRequest, NextResponse } from "next/server";
import { redeemSession } from "@/lib/app-handoff";
import { setSessionCookies } from "@/lib/session-cookies";

/**
 * The phone app's last step of a Discord/Google sign-in: the one-time code the callback sent it back with, plus the verifier
 * only it knows (lib/app-handoff). Answers with the session cookies, set on the app's own connection.
 */
export async function POST(req: NextRequest) {
  const payload = (await req.json().catch(() => null)) as { code?: unknown; verifier?: unknown } | null;
  const code = typeof payload?.code === "string" ? payload.code : "";
  const verifier = typeof payload?.verifier === "string" ? payload.verifier : "";
  if (!code || verifier.length < 43 || verifier.length > 128) {
    return NextResponse.json({ code: "invalid_body", message: "Invalid request body." }, { status: 400 });
  }

  const tokens = redeemSession(code, verifier);
  if (!tokens) {
    return NextResponse.json({ code: "handoff_invalid", message: "This sign-in link has expired. Please try again." }, { status: 401 });
  }

  const response = new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  setSessionCookies(response, tokens);
  return response;
}
