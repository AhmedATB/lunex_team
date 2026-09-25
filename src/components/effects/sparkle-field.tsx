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

/**
 * Fixed points on the page, not on the screen. Every star and crystal has its own spot in the background: it
 * scrolls away with the content like anything else on the page, instead of following the reader down the screen
 * (readers found that distracting, 2026-09-25 and 2026-09-26). Each one still twinkles or pulses — in place, never moving.
 *
 * The spots hug the left and right edges — inside the page's side margin, which is 16 px on a phone — so they stay out
 * from behind text and cards, and the layer sits before the content in the DOM, so text is always painted over it.
 * The pattern is one 1500 px "screenful" of eight points, repeated down the page.
 */
const GROUP_HEIGHT_PX = 1500;
const GROUPS = 6;

interface Point {
  /** Distance from the left (`side: "start"`) or right (`"end"`) edge of the page, in px. edge + size stays within 16. */
  edge: number;
  side: "start" | "end";
  /** Distance from the top of the group, in px. */
  top: number;
  size: number;
  kind: "star" | "crystal";
  color: number;
}

const POINTS: Point[] = [
  { edge: 3, side: "start", top: 140, size: 10, kind: "star", color: 0 },
  { edge: 4, side: "end", top: 260, size: 8, kind: "star", color: 1 },
  { edge: 3, side: "start", top: 470, size: 10, kind: "crystal", color: 0 },
  { edge: 2, side: "end", top: 640, size: 10, kind: "star", color: 2 },
  { edge: 5, side: "start", top: 860, size: 8, kind: "star", color: 3 },
  { edge: 3, side: "end", top: 1010, size: 10, kind: "crystal", color: 1 },
  { edge: 2, side: "start", top: 1210, size: 10, kind: "star", color: 4 },
  { edge: 5, side: "end", top: 1380, size: 8, kind: "star", color: 0 },
];

const LAYOUT = Array.from({ length: GROUPS }).flatMap((_, group) =>
  POINTS.map((point, i) => ({
    ...point,
    id: `${group}-${i}`,
    // each repeat sits a little higher or lower so the pattern does not look stamped (deterministic: server and client must agree)
    top: group * GROUP_HEIGHT_PX + point.top + ((group * 5 + i * 3) % 7) * 20 - 60,
    // when and how fast it pulses; deterministic, so the stars do not all blink together and server and client agree
    delay: `${(((group * 8 + i) * 37) % 50) / 10}s`,
    duration: `${2.2 + (((group * 8 + i) * 13) % 20) / 10}s`,
  }))
);

export function SparkleField({ initialStyle }: { initialStyle: StyleId }) {
  const liveStyle = useTheme((s) => s.style);
  const hasHydrated = useTheme((s) => s.hasHydrated);
  const style = hasHydrated ? liveStyle : initialStyle;
  const palette = paletteFor(style);

  return (
    // No negative z-index — see AppShell's decorative-layer comment; it rendered invisible at this position.
    // `absolute` inside the page (not `fixed`): the points belong to the page and scroll with it. They pulse in place only.
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-60" aria-hidden="true">
      {LAYOUT.map((p) => {
        const colors = p.kind === "star" ? palette.stars : palette.crystals;
        const color = colors[p.color % colors.length];
        return (
          <svg
            key={p.id}
            className={p.kind === "star" ? "sparkle-star" : "sparkle-pulse"}
            style={{
              position: "absolute",
              animationDelay: p.delay,
              animationDuration: p.duration,
              top: p.top,
              [p.side === "start" ? "left" : "right"]: p.edge,
              width: p.size,
              height: p.size,
              color,
              opacity: p.kind === "crystal" ? 0.5 : 0.9,
              filter: `drop-shadow(0 0 ${p.size / 3}px ${color})`,
            }}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            {p.kind === "star" ? (
              <path d="M12 0c0 6.075 5.925 12 12 12-6.075 0-12 5.925-12 12 0-6.075-5.925-12-12-12C6.075 12 12 6.075 12 0z" />
            ) : (
              <path d="M12 1 L20 8 L12 23 L4 8 Z" />
            )}
          </svg>
        );
      })}
    </div>
  );
}
