"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ADS_ENABLED, AD_UNITS, AD_UNIT_SANDBOX, buildAdDocument, isAdPage, type AdUnitId } from "@/lib/ads";
import { cn } from "@/lib/utils";

/** Until the native widget reports its real height, keep this much room so the page does not jump when it appears. */
const NATIVE_PLACEHOLDER_PX = 260;
const NATIVE_MAX_PX = 700;
/** A native widget that shows nothing in this long is taken to have no ad to show, and its space is given back. */
const NATIVE_GIVE_UP_MS = 9000;

/**
 * One placed ad: a banner of a fixed size, or the native widget. Labelled "إعلان", it reserves its own space (no layout
 * jump), loads only when scrolled near, and appears only on the browsing pages where ads may run (lib/ads.ts) and only
 * while ads are switched on. Nothing is rendered on the server.
 */
export function AdUnit({ unit, className }: { unit: AdUnitId; className?: string }) {
  const pathname = usePathname();
  const def = AD_UNITS[unit];
  const frame = useRef<HTMLIFrameElement>(null);
  const [mounted, setMounted] = useState(false);
  const [nativeHeight, setNativeHeight] = useState<number | null>(null);
  const [empty, setEmpty] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // The give-up timer must see the latest height without re-arming on every report.
  const nativeHeightRef = useRef<number | null>(null);
  nativeHeightRef.current = nativeHeight;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (def.kind !== "native") return;
    function onMessage(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow) return;
      const data = event.data as { lunexAd?: unknown; height?: unknown } | null;
      if (data?.lunexAd !== def.key || typeof data.height !== "number" || !Number.isFinite(data.height)) return;
      setNativeHeight(Math.min(NATIVE_MAX_PX, Math.max(60, Math.ceil(data.height))));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [def]);

  // The frame loads lazily, so the clock starts when it has actually loaded, not when the page did.
  useEffect(() => {
    if (def.kind !== "native" || !loaded) return;
    const giveUp = window.setTimeout(() => {
      if (nativeHeightRef.current === null) setEmpty(true);
    }, NATIVE_GIVE_UP_MS);
    return () => window.clearTimeout(giveUp);
  }, [def, loaded]);

  if (!mounted || !ADS_ENABLED || !isAdPage(pathname) || empty) return null;

  const isNative = def.kind === "native";
  const width = def.kind === "banner" ? def.width : undefined;
  const height = def.kind === "banner" ? def.height : (nativeHeight ?? NATIVE_PLACEHOLDER_PX);

  return (
    <aside aria-label="إعلان" className={cn("mx-auto w-full", className)} style={{ maxWidth: isNative ? 560 : width }}>
      <p className="mb-1 text-center text-[10px] text-lunex-gray/70">إعلان</p>
      <iframe
        ref={frame}
        title="إعلان"
        srcDoc={buildAdDocument(unit)}
        onLoad={() => setLoaded(true)}
        loading="lazy"
        scrolling="no"
        width={width ?? "100%"}
        height={height}
        style={{ border: 0, display: "block", margin: "0 auto", maxWidth: "100%", width: width ?? "100%", height }}
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
