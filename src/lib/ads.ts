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

/**
 * The popunder is the network's click trap: it lays an invisible layer over the whole page, so a visitor's first click — on a
 * work's card, a chapter, a menu — opens an advertiser's page in a new tab instead of doing what they clicked. It reads as
 * a page that "loads slowly and sends you back to the home page". Off unless NEXT_PUBLIC_ADS_POPUNDER=true (build time);
 * the social bar and the banners keep running.
 */
export const POPUNDER_ENABLED = process.env.NEXT_PUBLIC_ADS_POPUNDER === "true";

export const POPUNDER_SRC = "https://movementssubscriptionobjection.com/7b/5f/9f/7b5f9f10106213dda3868111f8cdee82.js";
export const SOCIAL_BAR_SRC = "https://movementssubscriptionobjection.com/be/5b/5b/be5b5b89c50e388d54f1b6f8210aa398.js";

/** A sponsored link: it only leaves the site when the visitor clicks it, so it needs no consent, but it is always labelled. */
export const SMARTLINK_URL = "https://movementssubscriptionobjection.com/jatf7ivdc?key=87cff15730ca079143c8b1333bd96466";
export const SPONSORED_LINK_REL = "sponsored nofollow noopener noreferrer";

/**
 * The placed banners. Each runs in its own small iframe rather than in the page: the banner code sets a global
 * (`atOptions`) that two banners on one page would overwrite, so a frame per unit keeps every unit's code apart. The keys
 * are public identifiers of the network's zones (they are in the page source of any site that shows them).
 *
 * There is deliberately no "native" widget: it renders large picture cards, and what the network served through it was
 * clickbait with photos of women — not something to put in front of this audience (owner's decision, 2026-09-27).
 */
const AD_HOST = "https://movementssubscriptionobjection.com";

export type AdUnitId = "banner728" | "banner320" | "banner300";

interface AdUnitDef {
  key: string;
  width: number;
  height: number;
}

export const AD_UNITS: Record<AdUnitId, AdUnitDef> = {
  banner728: { key: "ce8190b1d510809f854208d53e507fc4", width: 728, height: 90 },
  banner320: { key: "0d9c1490c8b5db922d7a6590b0ad0800", width: 320, height: 50 },
  banner300: { key: "a69852df20a3e2e3092036a188ca4306", width: 300, height: 250 },
};

/**
 * Run each unit's frame in a sandbox with no access to the page (no same-origin). Off by default: some networks check the
 * site from the frame's referrer and serve nothing to a sandboxed one; set NEXT_PUBLIC_ADS_SANDBOX=true to isolate the
 * units, and turn it back off if they stop filling.
 */
export const AD_UNIT_SANDBOX = process.env.NEXT_PUBLIC_ADS_SANDBOX === "true";

/** The document a unit's frame shows: the network's own snippet, unchanged, on an otherwise empty page. */
export function buildAdDocument(unit: AdUnitId): string {
  const def = AD_UNITS[unit];
  const src = `${AD_HOST}/${def.key}/invoke.js`;
  const head =
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}</style></head><body>";
  const options = JSON.stringify({ key: def.key, format: "iframe", height: def.height, width: def.width, params: {} });
  return `${head}<script>atOptions=${options};</script><script src="${src}"></script></body></html>`;
}

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
