/**
 * The site's ad network (three placements from one account: a popunder, a social bar and a smartlink).
 *
 * Ads are how the site earns, so they load for every visitor whatever they chose in the cookie banner (the banner
 * governs the site's own storage only; the privacy policy says so). What still confines third-party ad code:
 *  1. It loads only on browsing pages (BROWSE_PAGES). Never on sign-in and sign-up (a script there could read a password
 *     as it is typed), the account and admin pages, messages and the store, and never on the reader: a chapter page is
 *     decrypted into a canvas any script on the page can read, which would bypass the anti-piracy pipeline (§22).
 *  2. Scripts cannot be unloaded, so leaving a browsing page for a protected one reloads the document without them
 *     (components/ads/ad-scripts.tsx).
 *  3. NEXT_PUBLIC_ADS_ENABLED=false switches all of it off (at build time) without touching code.
 */
export const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED !== "false";

export const POPUNDER_SRC = "https://movementssubscriptionobjection.com/7b/5f/9f/7b5f9f10106213dda3868111f8cdee82.js";
export const SOCIAL_BAR_SRC = "https://movementssubscriptionobjection.com/be/5b/5b/be5b5b89c50e388d54f1b6f8210aa398.js";

/** A sponsored link: it only leaves the site when the visitor clicks it, so it needs no consent, but it is always labelled. */
export const SMARTLINK_URL = "https://movementssubscriptionobjection.com/jatf7ivdc?key=87cff15730ca079143c8b1333bd96466";
export const SPONSORED_LINK_REL = "sponsored nofollow noopener noreferrer";

/** Pages where the ad scripts may run. Anything not matched is protected. */
const BROWSE_PAGES = [
  /^\/$/,
  /^\/series$/,
  /^\/series\/[^/]+$/, // a series' page — but not /series/x/12, which is the reader
  /^\/search$/,
  /^\/teams$/,
  /^\/teams\/[^/]+$/, // a team's page — but not its dashboard
  /^\/news(\/[^/]+)?$/,
  /^\/bookmarks$/,
  /^\/privacy$/,
  /^\/terms$/,
];

export function isAdPage(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return BROWSE_PAGES.some((pattern) => pattern.test(path));
}
