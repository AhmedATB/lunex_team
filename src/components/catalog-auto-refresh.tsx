"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps the numbers on a page (views, this week's readers, ratings, the newest chapters) moving while it is open.
 * Every minute — and when the tab comes back into view after a while — it asks Next.js to re-render the page on the
 * server, which reads the catalogue again (it is cached for a few seconds there). Nothing flashes and nothing typed
 * is lost: only the data changes. A hidden tab does not refresh at all.
 */
export function CatalogAutoRefresh({ everyMs = 60_000 }: { everyMs?: number }) {
  const router = useRouter();
  const last = useRef(Date.now());

  useEffect(() => {
    function refresh() {
      if (document.visibilityState !== "visible") return;
      last.current = Date.now();
      router.refresh();
    }
    const timer = setInterval(refresh, everyMs);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last.current >= everyMs) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, everyMs]);

  return null;
}
