"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ADS_ENABLED, isAdPage, POPUNDER_ENABLED, POPUNDER_SRC, SOCIAL_BAR_SRC } from "@/lib/ads";
import { reportAd } from "@/lib/ads-status";
import { installTitleGuard } from "@/lib/title-guard";
import { AdsDebugPanel } from "@/components/ads/ads-debug";

declare global {
  interface Window {
    __lunexAdsLoaded?: boolean;
  }
}

function add(parent: HTMLElement, src: string, id: string) {
  if (document.querySelector(`script[data-lunex-ad="${id}"]`)) return;
  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  script.dataset.lunexAd = id;
  // "load" fires when the network's code arrived; "error" when something in the visitor's browser or network stopped it.
  script.onload = () => reportAd(id, "script loaded");
  script.onerror = () => reportAd(id, "blocked or failed");
  parent.appendChild(script);
}

/**
 * Loads the ad network's scripts for every visitor, on browsing pages only (see lib/ads.ts for why). The popunder (when
 * it is switched on) goes in the head and the social bar at the end of the body, as the network asks. They wait until the
 * browser is idle, so they never compete with the page for the first seconds of loading and hydration.
 *
 * A script cannot be taken back out of a running page, so when the visitor moves to a page that must be free of them
 * (sign-in, account, admin, the reader ...) the document is reloaded without them.
 */
export function AdScripts() {
  const pathname = usePathname();

  // Ad code must not pass itself off as the site (a tab title like "(1) New Message!"); see lib/title-guard.ts.
  useEffect(() => installTitleGuard(), []);

  useEffect(() => {
    if (!(ADS_ENABLED && isAdPage(pathname))) {
      if (window.__lunexAdsLoaded) window.location.reload();
      return;
    }

    const load = () => {
      if (POPUNDER_ENABLED) add(document.head, POPUNDER_SRC, "popunder");
      add(document.body, SOCIAL_BAR_SRC, "social-bar");
      window.__lunexAdsLoaded = true;
    };
    // Leaving the page before the browser was idle cancels the load, so nothing needs taking back out.
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(load, { timeout: 5000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(load, 2500);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return <AdsDebugPanel />;
}
