"use client";

import { useTheme } from "@/store/theme";
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
 * varies per style, and that choice only exists client-side (localStorage,
 * not tied to an account). SSR/first paint always renders the default
 * style's layout; it swaps to the persisted choice after mount, same as
 * every other preference in this app (see store-hydration.tsx).
 */
export function HomeLayoutSwitcher(data: HomeLayoutData) {
  const style = useTheme((s) => s.style);

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
