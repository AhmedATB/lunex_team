import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_EXP_COOKIE,
  clearSessionCookies,
  REFRESH_TOKEN_COOKIE,
  setSessionCookies,
} from "@/lib/session-cookies";

const REFRESH_MARGIN_MS = 30_000; // refresh proactively, not just after the token has already died
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

/**
 * Silent refresh, running before every page/API request: if the access
 * token is missing or expiring within REFRESH_MARGIN_MS, rotate it using the
 * refresh cookie and rewrite the request's own cookies before it reaches any
 * Server Component — so getServerSession() always sees a live token within
 * the same request that triggered the refresh, not just the next one.
 *
 * This can ONLY happen here, not inside a Server Component: Server
 * Components can't set cookies, and calling refresh() there without
 * persisting the result would rotate the token and then discard it,
 * tripping the backend's reuse-detection on the very next request.
 */
export async function middleware(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) return NextResponse.next();

  const expiresAtRaw = request.cookies.get(ACCESS_TOKEN_EXP_COOKIE)?.value;
  const expiresAtMs = expiresAtRaw ? Number(expiresAtRaw) : 0;
  const needsRefresh = !expiresAtMs || Date.now() > expiresAtMs - REFRESH_MARGIN_MS;
  if (!needsRefresh) return NextResponse.next();

  try {
    const res = await fetch(`${BACKEND_URL}/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "LunexTeamBFF/1.0 (+server-to-server)" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });

    if (!res.ok) {
      // Refresh token invalid/expired/reuse-detected — the session is
      // genuinely over, not a transient failure. Clear cookies so the app
      // renders as logged-out instead of stuck retrying a dead token.
      const response = NextResponse.next();
      clearSessionCookies(response);
      return response;
    }

    const tokens: { accessToken: string; refreshToken: string; expiresIn: number } = await res.json();

    // Mutating request.cookies also mutates the shared request.headers
    // Cookie header (see RequestCookies.set in Next's edge-runtime cookies
    // implementation) — passing that same Headers instance into next({request})
    // is what makes downstream Server Components see the fresh token on THIS request.
    request.cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken);

    const response = NextResponse.next({ request: { headers: request.headers } });
    setSessionCookies(response, tokens);
    return response;
  } catch {
    // Backend unreachable — fail open on this one request rather than
    // logging everyone out over a transient network blip; the next request
    // retries the same refresh.
    return NextResponse.next();
  }
}

export const config = {
  // Everything except our own auth routes (they manage cookies directly),
  // Next internals, and static assets.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
