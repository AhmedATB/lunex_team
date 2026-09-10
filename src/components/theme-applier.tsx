"use client";

import { useEffect } from "react";
import { ACCENT_PRESETS } from "@/lib/accent-presets";
import { useTheme } from "@/store/theme";

const ACCENT_VAR_NAMES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

/**
 * Reactively syncs the theme store to the DOM: `data-style` on <html> picks
 * which globals.css [data-style="..."] token block applies, and an accent
 * override (independent of style — see store/theme.ts) is layered on top as
 * inline custom properties, which win over the attribute-selector rules by
 * normal CSS specificity/source-order without needing !important.
 */
export function ThemeApplier() {
  const style = useTheme((s) => s.style);
  const accent = useTheme((s) => s.accent);
  const hasHydrated = useTheme((s) => s.hasHydrated);

  useEffect(() => {
    // Before hydration finishes, `style` is still the store's hardcoded
    // default, not the visitor's real saved choice — layout.tsx already set
    // the correct value server-side from the lunex-style cookie, so writing
    // here too early would stomp that with the wrong one. Only take over
    // once the live value is trustworthy.
    if (!hasHydrated) return;
    document.documentElement.dataset.style = style;
  }, [style, hasHydrated]);

  useEffect(() => {
    const root = document.documentElement.style;
    const preset = accent ? ACCENT_PRESETS.find((a) => a.id === accent) : undefined;
    if (!preset) {
      for (const shade of ACCENT_VAR_NAMES) root.removeProperty(`--primary-${shade}`);
      root.removeProperty("--lunex-purple");
      root.removeProperty("--lunex-violet");
      root.removeProperty("--lunex-lilac");
      return;
    }
    for (const shade of ACCENT_VAR_NAMES) root.setProperty(`--primary-${shade}`, preset.shades[shade]);
    root.setProperty("--lunex-purple", preset.lunexPurple);
    root.setProperty("--lunex-violet", preset.lunexViolet);
    root.setProperty("--lunex-lilac", preset.lunexLilac);
  }, [accent]);

  return null;
}
