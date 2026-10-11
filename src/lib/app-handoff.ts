import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { SessionTokens } from "@/lib/session-cookies";

/**
 * Discord/Google sign-in for the phone app. The app cannot receive the session cookies the provider's redirect sets — that
 * redirect lands in the phone's browser, not in the app — so the callback parks the new session here under a one-time code and
 * sends the browser back to the app (`lunex://auth?code=…`). The app then trades the code for the session cookies through its
 * own connection (POST /api/auth/app/exchange).
 *
 * The same idea as OAuth's PKCE (RFC 7636 / RFC 8252): the app picked a random `verifier` before starting and sent only its
 * SHA-256 (`challenge`). A code is worth nothing without the verifier, so another app that intercepts the `lunex://` link — any
 * app may claim a URL scheme — gets nothing it can use.
 *
 * Kept in memory: a code lives two minutes and is used once, seconds after it is made. A restart in between only means
 * signing in again.
 */
const TTL_MS = 2 * 60_000;

interface Parked {
  tokens: SessionTokens;
  challenge: string;
  expiresAt: number;
}

const parked = new Map<string, Parked>();

function sweep(now: number) {
  for (const [code, entry] of parked) if (entry.expiresAt < now) parked.delete(code);
}

/** A challenge is base64url SHA-256: 43 characters. */
export const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Where the app may be sent back to: its own scheme in a store build, Expo Go's while developing. Never a web address. */
export function isAppReturnUrl(url: string): boolean {
  return /^(lunex|exp):\/\/[^\s]*$/.test(url) && url.length <= 300;
}

export function parkSession(tokens: SessionTokens, challenge: string): string {
  const now = Date.now();
  sweep(now);
  const code = randomBytes(32).toString("base64url");
  parked.set(code, { tokens, challenge, expiresAt: now + TTL_MS });
  return code;
}

/** The parked session, if the code is live and the verifier is the one its challenge was made from. Single use either way. */
export function redeemSession(code: string, verifier: string): SessionTokens | null {
  const now = Date.now();
  sweep(now);
  const entry = parked.get(code);
  if (!entry) return null;
  parked.delete(code);
  const actual = Buffer.from(createHash("sha256").update(verifier).digest("base64url"));
  const expected = Buffer.from(entry.challenge);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return entry.tokens;
}
