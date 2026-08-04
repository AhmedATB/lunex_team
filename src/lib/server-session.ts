import { cookies } from "next/headers";
import type { BackendPublicUser } from "@/lib/auth-types";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

/**
 * Server Components' way of asking "who is logged in" — always re-verifies
 * against the backend rather than trusting anything decoded client-side, so
 * there is exactly one place (the NestJS JwtAuthGuard) that ever validates a
 * token's signature. Middleware (src/middleware.ts) is what keeps the
 * lunex_at cookie fresh before this ever runs, so this stays a simple,
 * un-cached lookup rather than needing its own refresh fallback.
 */
export async function getServerSession(): Promise<BackendPublicUser | null> {
  const accessToken = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return null;

  const result = await callBackend<BackendPublicUser>("/v1/auth/me", { authToken: accessToken });
  if (!result.ok) return null;
  return result.body;
}
