import type { NextResponse } from "next/server";

export const ACCESS_TOKEN_COOKIE = "lunex_at";
export const ACCESS_TOKEN_EXP_COOKIE = "lunex_at_exp";
export const REFRESH_TOKEN_COOKIE = "lunex_rt";
export const OAUTH_STATE_COOKIE = "lunex_oauth_state";

const OAUTH_STATE_MAX_AGE = 300; // 5 minutes — long enough to complete a real consent screen, short enough that a stale value is useless

const REFRESH_TOKEN_MAX_AGE = 180 * 24 * 60 * 60; // 180 days — mirrors the backend's refresh-token TTL; renewed at every refresh

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

const isProd = process.env.NODE_ENV === "production";

const baseCookieOptions = {
  httpOnly: true, // never readable from client JS — the whole point of the BFF pattern
  secure: isProd,
  sameSite: "lax" as const,
  path: "/",
};

/** Sets all three session cookies on a Route Handler / Middleware response. Never call this with tokens that touched client JS. */
export function setSessionCookies(response: NextResponse, tokens: SessionTokens) {
  const accessExpiresAtMs = Date.now() + tokens.expiresIn * 1000;

  response.cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, { ...baseCookieOptions, maxAge: tokens.expiresIn });
  response.cookies.set(ACCESS_TOKEN_EXP_COOKIE, String(accessExpiresAtMs), {
    ...baseCookieOptions,
    maxAge: tokens.expiresIn,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...baseCookieOptions,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

export function clearSessionCookies(response: NextResponse) {
  for (const name of [ACCESS_TOKEN_COOKIE, ACCESS_TOKEN_EXP_COOKIE, REFRESH_TOKEN_COOKIE]) {
    response.cookies.set(name, "", { ...baseCookieOptions, maxAge: 0 });
  }
}

/** CSRF guard for the OAuth flow: set right before redirecting to the provider, checked against the `state` the provider echoes back on /api/auth/callback/[provider]. */
export function setOAuthStateCookie(response: NextResponse, state: string) {
  response.cookies.set(OAUTH_STATE_COOKIE, state, { ...baseCookieOptions, maxAge: OAUTH_STATE_MAX_AGE });
}

export function clearOAuthStateCookie(response: NextResponse) {
  response.cookies.set(OAUTH_STATE_COOKIE, "", { ...baseCookieOptions, maxAge: 0 });
  response.cookies.set(OAUTH_APP_COOKIE, "", { ...baseCookieOptions, maxAge: 0 });
}

/** Set when the phone app started the sign-in (lib/app-handoff): where to send the browser back to, and the app's challenge. */
export const OAUTH_APP_COOKIE = "lunex_oauth_app";

export interface OAuthAppReturn {
  returnUrl: string;
  challenge: string;
}

export function setOAuthAppCookie(response: NextResponse, value: OAuthAppReturn) {
  response.cookies.set(OAUTH_APP_COOKIE, JSON.stringify(value), { ...baseCookieOptions, maxAge: OAUTH_STATE_MAX_AGE });
}

export function readOAuthAppCookie(raw: string | undefined): OAuthAppReturn | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<OAuthAppReturn>;
    return typeof value.returnUrl === "string" && typeof value.challenge === "string"
      ? { returnUrl: value.returnUrl, challenge: value.challenge }
      : null;
  } catch {
    return null;
  }
}
