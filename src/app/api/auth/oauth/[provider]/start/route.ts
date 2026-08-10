import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { setOAuthStateCookie } from "@/lib/session-cookies";

interface StartResponse {
  url: string;
  state: string;
}

/**
 * A real browser navigation (the login page links here with a plain <a
 * href>, not a fetch) — the browser needs to physically land on Discord's/
 * Google's own consent screen next, which only a top-level redirect can do.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;

  const result = await callBackend<StartResponse>(`/v1/auth/oauth/${encodeURIComponent(provider)}/start`);
  if (!result.ok) {
    return NextResponse.redirect(new URL("/login?error=oauth_unavailable", req.url));
  }

  const response = NextResponse.redirect(result.body.url);
  setOAuthStateCookie(response, result.body.state);
  return response;
}
