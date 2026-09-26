"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ADS_ENABLED, AD_UNITS, AD_UNIT_SANDBOX, buildAdDocument, isAdPage, type AdUnitId } from "@/lib/ads";
import { adsDebugRequested, reportAd } from "@/lib/ads-status";
import { cn } from "@/lib/utils";

/**
 * For `?ads=debug`: a few seconds after a unit's frame loaded, look inside it (possible because the frame is same-origin
 * unless sandboxed) for what the network put there, and say whether an ad was actually served.
 */
function checkCreative(unit: AdUnitId, frame: HTMLIFrameElement | null) {
  const id = `unit:${unit}`;
  reportAd(id, "script loaded");
  window.setTimeout(() => {
    try {
      const doc = frame?.contentDocument;
      if (!doc) return reportAd(id, "unknown (sandboxed)");
      reportAd(id, doc.body.querySelector("iframe, img, a, ins, div") ? "creative shown" : "no ad served");
    } catch {
      reportAd(id, "unknown (sandboxed)");
    }
  }, 4000);
}

/**
 * One placed banner of a fixed size. Labelled "إعلان", it reserves its own space (no layout jump), loads only when
 * scrolled near, and appears only on the browsing pages where ads may run (lib/ads.ts) and only while ads are switched
 * on. Nothing is rendered on the server.
 */
export function AdUnit({ unit, className }: { unit: AdUnitId; className?: string }) {
  const pathname = usePathname();
  const { width, height } = AD_UNITS[unit];
  const frame = useRef<HTMLIFrameElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || !ADS_ENABLED || !isAdPage(pathname)) return null;

  return (
    <aside aria-label="إعلان" className={cn("mx-auto w-full", className)} style={{ maxWidth: width }}>
      <p className="mb-1 text-center text-[10px] text-lunex-gray/70">إعلان</p>
      <iframe
        ref={frame}
        title="إعلان"
        srcDoc={buildAdDocument(unit)}
        onLoad={() => {
          if (adsDebugRequested()) checkCreative(unit, frame.current);
        }}
        loading="lazy"
        scrolling="no"
        width={width}
        height={height}
        style={{ border: 0, display: "block", margin: "0 auto", maxWidth: "100%", width, height }}
        {...(AD_UNIT_SANDBOX ? { sandbox: "allow-scripts allow-popups allow-popups-to-escape-sandbox" } : {})}
      />
    </aside>
  );
}

/**
 * A banner that fits the screen: the 728×90 leaderboard where there is room for it, the 320×50 mobile banner otherwise
 * — only the one that fits is created, so the other never loads.
 */
export function ResponsiveBanner({ className }: { className?: string }) {
  const [wide, setWide] = useState<boolean | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 800px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  if (wide === null) return null;
  return <AdUnit unit={wide ? "banner728" : "banner320"} className={className} />;
}
