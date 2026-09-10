"use client";

import { useTheme } from "@/store/theme";
import type { StyleId } from "@/lib/theme-presets";

/**
 * Ambient neon layer rendered once in the root layout, so it's behind
 * EVERY page, not just the home page — a grid horizon + drifting cyan/
 * magenta glow blobs + a faint scanline texture. Only mounts when Neon
 * Cyber is the active style; every other style renders nothing here.
 * `initialStyle` (the lunex-style cookie, read server-side in layout.tsx)
 * avoids this incorrectly flashing in/out before the client store finishes
 * reading localStorage — same reasoning as HomeLayoutSwitcher.
 */
export function NeonBackdrop({ initialStyle }: { initialStyle: StyleId }) {
  const liveStyle = useTheme((s) => s.style);
  const hasHydrated = useTheme((s) => s.hasHydrated);
  const style = hasHydrated ? liveStyle : initialStyle;
  if (style !== "neon-cyber") return null;

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(rgb(var(--primary-400)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--primary-400)) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
        }}
      />
      <div className="ambient-blob start-[5%] top-[-10%] h-[420px] w-[420px] bg-primary-500/25" />
      <div
        className="ambient-blob end-[0%] top-[35%] h-[380px] w-[380px]"
        style={{ background: "rgb(var(--lunex-purple) / 0.22)", animationDelay: "-6s" }}
      />
      <div
        className="ambient-blob start-[20%] bottom-[-5%] h-[320px] w-[320px]"
        style={{ background: "rgb(var(--primary-400) / 0.15)", animationDelay: "-11s" }}
      />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, white 0px, white 1px, transparent 1px, transparent 3px)",
        }}
      />
    </div>
  );
}
