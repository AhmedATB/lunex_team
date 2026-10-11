import { NextRequest, NextResponse } from "next/server";
import { isAppReturnUrl, parkSession } from "@/lib/app-handoff";
import type { BackendAuthResponse, BackendErrorBody } from "@/lib/auth-types";
import { callBackend } from "@/lib/backend-client";
import { redirectTo } from "@/lib/request-origin";
import { clearOAuthStateCookie, OAUTH_APP_COOKIE, OAUTH_STATE_COOKIE, readOAuthAppCookie, setSessionCookies } from "@/lib/session-cookies";

/**
 * Discord/Google redirect the browser here directly (this is the exact
 * redirect_uri registered with each provider) — this is a real top-level
 * navigation, not a fetch, so errors are communicated back via redirecting
 * to /login with a query param rather than a JSON response.
 *
 * When the phone app started the sign-in (start route, lib/app-handoff), the
 * session goes to the app instead: parked under a one-time code, and the
 * browser is sent back to the app with it. The browser itself stays signed out.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const providerError = req.nextUrl.searchParams.get("error");

  const storedState = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  const app = readOAuthAppCookie(req.cookies.get(OAUTH_APP_COOKIE)?.value);
  const toApp = app && isAppReturnUrl(app.returnUrl) ? app : null;

  const fail = () => {
    const response = toApp ? NextResponse.redirect(`${toApp.returnUrl}?error=oauth_failed`) : redirectTo(req, "/login?error=oauth_failed");
    clearOAuthStateCookie(response);
    return response;
  };

  if (providerError || !code || !state || !storedState || state !== storedState) return fail();

  const result = await callBackend<BackendAuthResponse & BackendErrorBody>(
    `/v1/auth/oauth/${encodeURIComponent(provider)}/callback`,
    { method: "POST", body: { code } }
  );

  if (!result.ok) return fail();

  if (toApp) {
    const handoff = parkSession(result.body, toApp.challenge);
    const response = NextResponse.redirect(`${toApp.returnUrl}?code=${encodeURIComponent(handoff)}`);
    clearOAuthStateCookie(response);
    return response;
  }

  const response = redirectTo(req, "/profile");
  clearOAuthStateCookie(response);
  setSessionCookies(response, result.body);
  return response;
}
