"use client";

import { useTheme } from "@/store/theme";
import type { StyleId } from "@/lib/theme-presets";

/**
 * Default palette — every style except the ones with their own entry below
 * keeps today's look exactly as-is (violet-night's original purple/pink/gold).
 */
const DEFAULT_STAR_COLORS = ["#f0abfc", "#c084fc", "#fcd34d", "#e9d5ff", "#a855f7"];
const DEFAULT_CRYSTAL_COLORS = ["#c084fc", "#f0abfc"];

/** Blue Moon's own moonlit-ice palette — the "crystal" half of the style's موon-and-crystal identity, distinct from every other style's warmer purple/pink/gold sparkle. */
const BLUE_MOON_STAR_COLORS = ["#dbeafe", "#bfdbfe", "#e0f2fe", "#93c5fd", "#f8fafc"];
const BLUE_MOON_CRYSTAL_COLORS = ["#93c5fd", "#e0f2fe", "#bfdbfe"];

function paletteFor(style: StyleId) {
  if (style === "blue-moon") return { stars: BLUE_MOON_STAR_COLORS, crystals: BLUE_MOON_CRYSTAL_COLORS };
  return { stars: DEFAULT_STAR_COLORS, crystals: DEFAULT_CRYSTAL_COLORS };
}

function makeRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Deterministic per-item randomness (position/size/timing) so both server and client render the same layout — only the COLOR varies by style, picked at render time from the palette above. */
const STAR_LAYOUT = Array.from({ length: 70 }).map((_, i) => {
  const rand = makeRand(i * 9301 + 49297);
  return {
    id: `star-${i}`,
    top: `${rand() * 100}%`,
    left: `${rand() * 100}%`,
    size: 7 + rand() * 15,
    delay: `${rand() * 5}s`,
    duration: `${1.8 + rand() * 2.8}s`,
    colorIndex: Math.floor(rand() * DEFAULT_STAR_COLORS.length),
  };
});

const CRYSTAL_LAYOUT = Array.from({ length: 18 }).map((_, i) => {
  const rand = makeRand(i * 6151 + 12007);
  return {
    id: `crystal-${i}`,
    top: `${rand() * 100}%`,
    left: `${rand() * 100}%`,
    size: 10 + rand() * 14,
    delay: `${rand() * 6}s`,
    duration: `${5 + rand() * 3}s`,
    colorIndex: rand() > 0.5 ? 0 : 1,
  };
});

export function SparkleField({ initialStyle }: { initialStyle: StyleId }) {
  const liveStyle = useTheme((s) => s.style);
  const hasHydrated = useTheme((s) => s.hasHydrated);
  const style = hasHydrated ? liveStyle : initialStyle;
  const palette = paletteFor(style);

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {STAR_LAYOUT.map((s) => {
        const color = palette.stars[s.colorIndex % palette.stars.length];
        return (
          <svg
            key={s.id}
            className="sparkle-star absolute"
            style={{
              top: s.top,
              left: s.left,
              width: s.size,
              height: s.size,
              color,
              animationDelay: s.delay,
              animationDuration: s.duration,
              filter: `drop-shadow(0 0 ${s.size / 2}px ${color})`,
            }}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 0c0 6.075 5.925 12 12 12-6.075 0-12 5.925-12 12 0-6.075-5.925-12-12-12C6.075 12 12 6.075 12 0z" />
          </svg>
        );
      })}
      {CRYSTAL_LAYOUT.map((c) => {
        const color = palette.crystals[c.colorIndex % palette.crystals.length];
        return (
          <svg
            key={c.id}
            className="float-slow absolute opacity-40"
            style={{
              top: c.top,
              left: c.left,
              width: c.size,
              height: c.size,
              color,
              animationDelay: c.delay,
              animationDuration: c.duration,
              filter: `drop-shadow(0 0 ${c.size / 2}px ${color})`,
            }}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 1 L20 8 L12 23 L4 8 Z" />
          </svg>
        );
      })}
    </div>
  );
}
