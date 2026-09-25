"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ADS_CONSENT_CHANGED_EVENT, hasAdsConsent } from "@/lib/consent";
import { ADS_ENABLED, isAdPage, POPUNDER_SRC, SOCIAL_BAR_SRC } from "@/lib/ads";

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
  parent.appendChild(script);
}

/**
 * Loads the ad network's scripts — only for a visitor who agreed to advertising and only on browsing pages (see
 * lib/ads.ts for why). The popunder goes in the head and the social bar at the end of the body, as the network asks.
 *
 * A script cannot be taken back out of a running page, so when the visitor moves to a page that must be free of them
 * (sign-in, account, admin, the reader ...), or withdraws consent, the document is reloaded without them.
 */
export function AdScripts() {
  const pathname = usePathname();

  useEffect(() => {
    function sync() {
      const allowed = ADS_ENABLED && hasAdsConsent() && isAdPage(pathname);
      if (allowed) {
        add(document.head, POPUNDER_SRC, "popunder");
        add(document.body, SOCIAL_BAR_SRC, "social-bar");
        window.__lunexAdsLoaded = true;
      } else if (window.__lunexAdsLoaded) {
        window.location.reload();
      }
    }
    sync();
    // Consent given (or withdrawn) in the banner takes effect on this very page.
    window.addEventListener(ADS_CONSENT_CHANGED_EVENT, sync);
    return () => window.removeEventListener(ADS_CONSENT_CHANGED_EVENT, sync);
  }, [pathname]);

  return null;
}
