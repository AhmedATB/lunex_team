import { NextRequest } from "next/server";
import type { BackendAuthResponse, BackendErrorBody } from "@/lib/auth-types";
import { callBackend } from "@/lib/backend-client";
import { redirectTo } from "@/lib/request-origin";
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
    const response = redirectTo(req, "/login?error=oauth_failed");
    clearOAuthStateCookie(response);
    return response;
  }

  const result = await callBackend<BackendAuthResponse & BackendErrorBody>(
    `/v1/auth/oauth/${encodeURIComponent(provider)}/callback`,
    { method: "POST", body: { code } }
  );

  if (!result.ok) {
    const response = redirectTo(req, "/login?error=oauth_failed");
    clearOAuthStateCookie(response);
    return response;
  }

  const response = redirectTo(req, "/profile");
  clearOAuthStateCookie(response);
  setSessionCookies(response, result.body);
  return response;
}
