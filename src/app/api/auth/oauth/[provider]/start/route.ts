import { NextRequest, NextResponse } from "next/server";
import { CHALLENGE_PATTERN, isAppReturnUrl } from "@/lib/app-handoff";
import { callBackend } from "@/lib/backend-client";
import { redirectTo } from "@/lib/request-origin";
import { setOAuthAppCookie, setOAuthStateCookie } from "@/lib/session-cookies";

interface StartResponse {
  url: string;
  state: string;
}

/**
 * A real browser navigation (the login page links here with a plain <a
 * href>, not a fetch) — the browser needs to physically land on Discord's/
 * Google's own consent screen next, which only a top-level redirect can do.
 *
 * The phone app opens this same address in the phone's browser with
 * `app_return` (where to send the browser back to) and `app_challenge`; the
 * callback then hands the session to the app instead of to the browser (see
 * lib/app-handoff).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const appReturn = req.nextUrl.searchParams.get("app_return");
  const appChallenge = req.nextUrl.searchParams.get("app_challenge");
  const fromApp = appReturn !== null || appChallenge !== null;
  if (fromApp && !(appReturn && isAppReturnUrl(appReturn) && appChallenge && CHALLENGE_PATTERN.test(appChallenge))) {
    return redirectTo(req, "/login?error=oauth_failed");
  }

  const result = await callBackend<StartResponse>(`/v1/auth/oauth/${encodeURIComponent(provider)}/start`);
  if (!result.ok) {
    return fromApp
      ? NextResponse.redirect(`${appReturn}?error=oauth_unavailable`)
      : redirectTo(req, "/login?error=oauth_unavailable");
  }

  const response = NextResponse.redirect(result.body.url);
  setOAuthStateCookie(response, result.body.state);
  if (fromApp) setOAuthAppCookie(response, { returnUrl: appReturn!, challenge: appChallenge! });
  return response;
}
