"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useNavigation } from "@/store/navigation";

const FAILSAFE_MS = 20000;

/**
 * Turns every internal link click into an immediate, visible reaction: it
 * records the destination in the navigation store (which the page area uses
 * to swap in a skeleton) and runs a thin bar along the top until the new
 * URL lands. Without this, a click on a slow page looks like nothing
 * happened, so people click again.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const pendingHref = useNavigation((s) => s.pendingHref);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      useNavigation.getState().start(url.pathname + url.search);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // The URL changed: the navigation landed.
  useEffect(() => {
    useNavigation.getState().finish();
  }, [pathname, search]);

  // A navigation that never lands must not leave the page stuck on a skeleton.
  useEffect(() => {
    if (!pendingHref) return;
    const t = setTimeout(() => useNavigation.getState().finish(), FAILSAFE_MS);
    return () => clearTimeout(t);
  }, [pendingHref]);

  useEffect(() => {
    if (pendingHref) {
      setVisible(true);
      setProgress(8);
      const id = setInterval(() => setProgress((p) => p + (90 - p) * 0.08), 200);
      return () => clearInterval(id);
    }
    setProgress((p) => (p > 0 ? 100 : 0));
    const t = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 250);
    return () => clearTimeout(t);
  }, [pendingHref]);

  if (!visible) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]">
      <div
        className="absolute start-0 top-0 h-full bg-lunex-gradient shadow-[0_0_10px_rgb(var(--primary-400)/0.8)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
