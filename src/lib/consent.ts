import type { StateStorage } from "zustand/middleware";
import { STYLE_COOKIE } from "./theme-presets";

/**
 * Cookie/storage consent. Two tiers only, because that is all the site has:
 *  - essential (always on): login session cookies, security, and the storage
 *    behind features the reader actively uses (bookmarks, reading progress…);
 *  - preferences (opt-in): the theme cookie and the saved theme / reader
 *    display settings.
 * There are no analytics or advertising cookies, so there is no third tier.
 */
export const CONSENT_COOKIE = "lunex-consent";
export type ConsentChoice = "all" | "essential";

/** Dispatched on `window` by the footer's "cookie settings" link to bring the banner back. */
export const OPEN_COOKIE_SETTINGS_EVENT = "lunex:open-cookie-settings";

/** ~6 months, after which the choice is asked again. */
const CONSENT_MAX_AGE = 60 * 60 * 24 * 180;

/** localStorage keys that hold only preferences — written only with consent. */
export const PREFERENCE_STORAGE_KEYS = [
  "lunex-theme",
  "lunex-reader-settings",
  "lunex-novel-reader-settings",
  "lunex-preferences",
] as const;

export function parseConsent(value: string | undefined | null): ConsentChoice | null {
  return value === "all" || value === "essential" ? value : null;
}

export function readConsent(): ConsentChoice | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  return parseConsent(match?.slice(CONSENT_COOKIE.length + 1));
}

export function hasPreferenceConsent(): boolean {
  return readConsent() === "all";
}

export function writeConsent(choice: ConsentChoice) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${choice}; path=/; max-age=${CONSENT_MAX_AGE}; SameSite=Lax${secure}`;
}

/** Drops everything the "preferences" tier had stored. */
export function clearPreferenceStorage() {
  for (const key of PREFERENCE_STORAGE_KEYS) window.localStorage.removeItem(key);
  document.cookie = `${STYLE_COOKIE}=; path=/; max-age=0`;
}

/** localStorage for the preference stores: reads always work, writes happen only with consent. */
export const preferenceStorage: StateStorage = {
  getItem: (name) => (typeof window === "undefined" ? null : window.localStorage.getItem(name)),
  setItem: (name, value) => {
    if (typeof window !== "undefined" && hasPreferenceConsent()) window.localStorage.setItem(name, value);
  },
  removeItem: (name) => {
    if (typeof window !== "undefined") window.localStorage.removeItem(name);
  },
};
