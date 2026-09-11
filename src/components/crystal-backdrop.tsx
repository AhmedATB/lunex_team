"use client";

import { useTheme } from "@/store/theme";
import type { StyleId } from "@/lib/theme-presets";

/**
 * Always-on-screen crystal cluster for Blue Moon — `fixed`, so it shows in
 * every viewport regardless of scroll position, unlike SparkleField's
 * scattered stars/crystals (those are `absolute` across the FULL page
 * height, so on a long page almost none land in what's actually visible
 * without scrolling). This is what makes "crystals" a recognizable part of
 * the style on first load, not just an occasional thing you notice while
 * scrolling. `initialStyle` avoids the same SSR-mismatch flash NeonBackdrop
 * guards against.
 *
 * No negative z-index (see AppShell's own decorative-layer comment) —
 * staying behind real content relies on this being mounted early in DOM
 * order (inside AppShell's decorative wrapper, before Header/main/Footer),
 * not on `-z-10`, which rendered invisible here.
 */
export function CrystalBackdrop({ initialStyle }: { initialStyle: StyleId }) {
  const liveStyle = useTheme((s) => s.style);
  const hasHydrated = useTheme((s) => s.hasHydrated);
  const style = hasHydrated ? liveStyle : initialStyle;
  if (style !== "blue-moon") return null;

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      {/* Hugging the far edges, outside the centered content column (the site's container has real side margins on every breakpoint down to mobile's own px-4 gutter) — anywhere further in gets covered by ordinary opaque content (header, cards, hero), which is correct stacking, not a bug. */}
      <div className="crystal-shard start-[1%] top-[8%] h-12 w-12 opacity-70" />
      <div className="crystal-shard end-[1.5%] top-[30%] h-9 w-9 opacity-55" style={{ animationDelay: "-1.5s" }} />
      <div className="crystal-shard start-[2%] top-[55%] h-10 w-10 opacity-55" style={{ animationDelay: "-3s" }} />
      <div className="crystal-shard end-[1%] top-[70%] h-14 w-14 opacity-65" style={{ animationDelay: "-2.2s" }} />
      <div className="crystal-shard start-[1.5%] bottom-[4%] h-8 w-8 opacity-50" style={{ animationDelay: "-4s" }} />
    </div>
  );
}
