/** The site the app talks to. Every request goes through the site's own `/api` routes, the same ones the browser uses. */
export const SITE_URL = "https://lunexteam.com";

/**
 * Sent on every request. The backend turns away clients whose User-Agent looks automated (okhttp, curl, …), and okhttp is
 * what React Native sends on Android unless told otherwise.
 */
export const USER_AGENT = "Mozilla/5.0 (Linux; Android) LunexApp/0.1";

/** Cloudflare Turnstile public site key — the same one the site's sign-in form uses. Public by design. */
export const TURNSTILE_SITE_KEY = "0x4AAAAAAFErGoDygCtNTgHn";

/** Turns a site-relative address (`/api/catalog/...`) into a full one; full addresses pass through. */
export function absolute(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  return url.startsWith("/") ? `${SITE_URL}${url}` : url;
}
