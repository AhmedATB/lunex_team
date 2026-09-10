"use client";

import { useTheme } from "@/store/theme";
import type { StyleId } from "@/lib/theme-presets";
import { BlueMoonHome } from "./blue-moon-home";
import { CrimsonBloodHome } from "./crimson-blood-home";
import { HeroSunsetHome } from "./hero-sunset-home";
import { InkPaperHome } from "./ink-paper-home";
import { NeonCyberHome } from "./neon-cyber-home";
import type { HomeLayoutData } from "./types";
import { VioletNightHome } from "./violet-night-home";

/**
 * The home page's data fetching stays server-side (page.tsx) since it's the
 * same superset of data every layout draws from — only the ARRANGEMENT
 * varies per style. `initialStyle` comes from the lunex-style cookie
 * (theme-cookie.ts), read server-side, so SSR/first paint already renders
 * the visitor's real saved layout instead of always defaulting and
 * visibly swapping after mount. Once the client store finishes reading
 * localStorage (hasHydrated), the live value takes over — covering both a
 * first-ever visitor (no cookie yet) and a style change made this session.
 */
export function HomeLayoutSwitcher({ initialStyle, ...data }: HomeLayoutData & { initialStyle: StyleId }) {
  const liveStyle = useTheme((s) => s.style);
  const hasHydrated = useTheme((s) => s.hasHydrated);
  const style = hasHydrated ? liveStyle : initialStyle;

  switch (style) {
    case "neon-cyber":
      return <NeonCyberHome {...data} />;
    case "ink-paper":
      return <InkPaperHome {...data} />;
    case "hero-sunset":
      return <HeroSunsetHome {...data} />;
    case "blue-moon":
      return <BlueMoonHome {...data} />;
    case "crimson-blood":
      return <CrimsonBloodHome {...data} />;
    case "violet-night":
    default:
      return <VioletNightHome {...data} />;
  }
}
