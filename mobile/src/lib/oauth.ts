import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { fromByteArray } from "base64-js";
import { getRandomBytes } from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { apiFetch } from "./api";
import { SITE_URL } from "./config";

export type OAuthProvider = "google" | "discord";

const base64Url = (bytes: Uint8Array) => fromByteArray(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Thrown with a message ready to show; `cancelled` when the reader just closed the browser. */
export class OAuthError extends Error {
  constructor(
    message: string,
    readonly cancelled = false,
  ) {
    super(message);
  }
}

/**
 * Discord/Google sign-in. It runs in the phone's browser (Google refuses sign-ins inside an app's web view), which then sends
 * the reader back to the app with a one-time code; the code plus a secret that never left the app buys the session cookies.
 * The site's side is lib/app-handoff.ts.
 */
export async function signInWithProvider(provider: OAuthProvider): Promise<void> {
  const verifier = base64Url(getRandomBytes(32));
  const challenge = base64Url(sha256(utf8ToBytes(verifier)));
  // lunex://auth in a store build, exp://…/--/auth inside Expo Go.
  const returnUrl = Linking.createURL("auth");
  const startUrl =
    `${SITE_URL}/api/auth/oauth/${provider}/start` +
    `?app_return=${encodeURIComponent(returnUrl)}&app_challenge=${encodeURIComponent(challenge)}`;

  const result = await WebBrowser.openAuthSessionAsync(startUrl, returnUrl);
  if (result.type !== "success") throw new OAuthError("", true);

  const { queryParams } = Linking.parse(result.url);
  const code = typeof queryParams?.code === "string" ? queryParams.code : null;
  if (!code) {
    throw new OAuthError(
      queryParams?.error === "oauth_unavailable" ? "تسجيل الدخول عبر هذا المزود غير متاح حاليًا." : "تعذر تسجيل الدخول، حاول مرة أخرى.",
    );
  }

  const res = await apiFetch("/api/auth/app/exchange", { method: "POST", body: JSON.stringify({ code, verifier }) }).catch(() => null);
  if (!res?.ok) throw new OAuthError("انتهت صلاحية تسجيل الدخول، حاول مرة أخرى.");
}
