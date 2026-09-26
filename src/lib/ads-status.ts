/**
 * A small record of what each ad unit did in this browser, for finding out why nothing shows (`?ads=debug` on any page
 * shows it, see components/ads/ads-debug.tsx). It says whether the network's code was blocked in the visitor's browser
 * or arrived and simply had no ad to give — the two look identical on the page. Nothing here leaves the browser.
 */
declare global {
  interface Window {
    __lunexAds?: Record<string, string>;
  }
}

export const ADS_STATUS_EVENT = "lunex:ads-status";

export function reportAd(id: string, status: string) {
  if (typeof window === "undefined") return;
  (window.__lunexAds ??= {})[id] = status;
  window.dispatchEvent(new Event(ADS_STATUS_EVENT));
}

/** True when the page was opened with `?ads=debug`. */
export function adsDebugRequested(): boolean {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("ads") === "debug";
}
