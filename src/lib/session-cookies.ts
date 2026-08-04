import type { NextResponse } from "next/server";

export const ACCESS_TOKEN_COOKIE = "lunex_at";
export const ACCESS_TOKEN_EXP_COOKIE = "lunex_at_exp";
export const REFRESH_TOKEN_COOKIE = "lunex_rt";

const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days — mirrors the backend's refresh-token TTL

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
