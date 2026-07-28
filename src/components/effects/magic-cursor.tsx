"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#c084fc", "#f0abfc", "#fcd34d", "#a855f7"];

export function MagicCursor() {
  const lastSpawn = useRef(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    if (reduceMotion || !isFinePointer) return;

    function onMove(e: MouseEvent) {
      const now = performance.now();
      if (now - lastSpawn.current < 60) return;
      lastSpawn.current = now;

      const el = document.createElement("span");
      const size = 4 + Math.random() * 5;
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      el.style.cssText = `
        position: fixed;
        left: ${e.clientX}px;
        top: ${e.clientY}px;
        width: ${size}px;
        height: ${size}px;
        border-radius: 9999px;
        background: radial-gradient(circle, ${color} 0%, transparent 70%);
        pointer-events: none;
        z-index: 9999;
        transform: translate(-50%, -50%);
        animation: cursor-sparkle-fade 0.9s ease-out forwards;
      `;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 900);
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return null;
}
