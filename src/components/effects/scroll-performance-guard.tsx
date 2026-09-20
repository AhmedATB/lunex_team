"use client";

import { useEffect, useRef } from "react";

/**
 * Pauses the site's continuous decorative animations (ambient-blob,
 * sparkle-field, neon backdrop) while the user is actively scrolling, and
 * resumes them ~150ms after scrolling stops.
 *
 * These animations are cheap sitting still, but they're `position:absolute`
 * (deliberately, so they distribute across the full scroll height — see
 * AppShell's own comment on why) rather than `fixed`, which means the
 * browser can't just pan them as a static composited layer during scroll —
 * it repaints them every scroll frame, on top of whatever else is
 * animating. That repaint cost is exactly what showed up as "heavy while
 * scrolling" (reported 2026-09-20) even after trimming element counts
 * earlier — cutting COUNT reduces steady-state cost, but only cutting
 * ACTIVITY during the scroll gesture itself fixes jank during scroll.
 */
export function ScrollPerformanceGuard() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const root = document.documentElement;

    function onScroll() {
      root.classList.add("is-scrolling");
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => root.classList.remove("is-scrolling"), 150);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      root.classList.remove("is-scrolling");
    };
  }, []);

  return null;
}
