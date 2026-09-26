"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ADS_ENABLED, isAdPage, POPUNDER_SRC, SOCIAL_BAR_SRC } from "@/lib/ads";
import { reportAd } from "@/lib/ads-status";
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
 * Loads the ad network's scripts for every visitor, on browsing pages only (see lib/ads.ts for why). The popunder goes
 * in the head and the social bar at the end of the body, as the network asks.
 *
 * A script cannot be taken back out of a running page, so when the visitor moves to a page that must be free of them
 * (sign-in, account, admin, the reader ...) the document is reloaded without them.
 */
export function AdScripts() {
  const pathname = usePathname();

  useEffect(() => {
    if (ADS_ENABLED && isAdPage(pathname)) {
      add(document.head, POPUNDER_SRC, "popunder");
      add(document.body, SOCIAL_BAR_SRC, "social-bar");
      window.__lunexAdsLoaded = true;
    } else if (window.__lunexAdsLoaded) {
      window.location.reload();
    }
  }, [pathname]);

  return <AdsDebugPanel />;
}
