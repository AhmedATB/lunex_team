import { NextRequest, NextResponse } from "next/server";
import type { BackendAuthResponse, BackendErrorBody } from "@/lib/auth-types";
import { callBackend } from "@/lib/backend-client";
import { clearOAuthStateCookie, OAUTH_STATE_COOKIE, setSessionCookies } from "@/lib/session-cookies";

/**
 * Discord/Google redirect the browser here directly (this is the exact
 * redirect_uri registered with each provider) — this is a real top-level
 * navigation, not a fetch, so errors are communicated back via redirecting
 * to /login with a query param rather than a JSON response.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const providerError = req.nextUrl.searchParams.get("error");

  const storedState = req.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (providerError || !code || !state || !storedState || state !== storedState) {
    const response = NextResponse.redirect(new URL("/login?error=oauth_failed", req.url));
    clearOAuthStateCookie(response);
    return response;
  }

  const result = await callBackend<BackendAuthResponse & BackendErrorBody>(
    `/v1/auth/oauth/${encodeURIComponent(provider)}/callback`,
    { method: "POST", body: { code } }
  );

  if (!result.ok) {
    const response = NextResponse.redirect(new URL("/login?error=oauth_failed", req.url));
    clearOAuthStateCookie(response);
    return response;
  }

  const response = NextResponse.redirect(new URL("/profile", req.url));
  clearOAuthStateCookie(response);
  setSessionCookies(response, result.body);
  return response;
}
