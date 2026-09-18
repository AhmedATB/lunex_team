"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#c084fc", "#f0abfc", "#fcd34d", "#a855f7", "#e9d5ff"];
const STAR_PATH = "M12 0c0 6.075 5.925 12 12 12-6.075 0-12 5.925-12 12 0-6.075-5.925-12-12-12C6.075 12 12 6.075 12 0z";

function spawnOne(x: number, y: number, spread = 18) {
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const jitterX = x + (Math.random() - 0.5) * spread;
  const jitterY = y + (Math.random() - 0.5) * spread;
  const rotate = Math.random() * 360;
  const isStar = Math.random() > 0.55;
  const size = isStar ? 10 + Math.random() * 10 : 4 + Math.random() * 6;

  const wrapper = document.createElement(isStar ? "svg" : "span");
  wrapper.style.cssText = `
    position: fixed;
    left: ${jitterX}px;
    top: ${jitterY}px;
    width: ${size}px;
    height: ${size}px;
    pointer-events: none;
    z-index: 9999;
    transform: translate(-50%, -50%) rotate(${rotate}deg);
    animation: cursor-sparkle-fade ${0.7 + Math.random() * 0.5}s ease-out forwards;
    filter: drop-shadow(0 0 6px ${color});
  `;
  if (isStar) {
    wrapper.setAttribute("viewBox", "0 0 24 24");
    wrapper.setAttribute("fill", color);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", STAR_PATH);
    wrapper.appendChild(path);
  } else {
    wrapper.style.borderRadius = "9999px";
    wrapper.style.background = `radial-gradient(circle, ${color} 0%, transparent 70%)`;
  }
  document.body.appendChild(wrapper);
  setTimeout(() => wrapper.remove(), 1200);
}

export function MagicCursor() {
  const lastSpawn = useRef(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    /*
     * Mouse-only from here — there used to also be a touch-tap burst (6 DOM
     * nodes spawned per touchstart, each with an animated drop-shadow
     * filter). Removed: `touchstart` fires at the start of every scroll
     * gesture, not just discrete taps, so on a reading app where scrolling
     * is the primary interaction, this was firing constantly and was the
     * single most likely source of the real mobile lag reported (dev/perf
     * feedback: "UX matters more than how nice it looks", 2026-09-19).
     */
    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    if (!isFinePointer) return;

    function onMove(e: MouseEvent) {
      const now = performance.now();
      if (now - lastSpawn.current < 35) return;
      lastSpawn.current = now;
      spawnOne(e.clientX, e.clientY);
      if (Math.random() > 0.6) spawnOne(e.clientX, e.clientY);
    }
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return null;
}
