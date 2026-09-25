"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_STYLE, STYLE_COOKIE, type StyleId } from "@/lib/theme-presets";
import { hasPreferenceConsent, preferenceStorage } from "@/lib/consent";
import type { AccentId } from "@/lib/accent-presets";

interface ThemeState {
  style: StyleId;
  /** null = use the active style's own built-in accent (today's behavior). Set to override just the accent on top of whichever style is active. */
  accent: AccentId | null;
  /** True once the persisted value has been read from localStorage — see store-hydration.tsx. Lets SSR-sensitive consumers (NeonBackdrop, SparkleField) know when it's safe to trust `style` instead of the server-provided initial value. */
  hasHydrated: boolean;
  setStyle: (style: StyleId) => void;
  setAccent: (accent: AccentId | null) => void;
}

/** Mirrors the style choice into a cookie so Server Components can read it too (theme-cookie.ts) — localStorage alone is invisible to SSR, which is exactly what causes the default-then-swap flash this cookie exists to avoid. Only written once the reader has accepted preference storage. */
export function writeStyleCookie(style: StyleId) {
  if (typeof document === "undefined" || !hasPreferenceConsent()) return;
  document.cookie = `${STYLE_COOKIE}=${style}; path=/; max-age=31536000; SameSite=Lax`;
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      style: DEFAULT_STYLE,
      accent: null,
      hasHydrated: false,
      setStyle: (style) => {
        writeStyleCookie(style);
        set({ style });
      },
      setAccent: (accent) => set({ accent }),
    }),
    {
      name: "lunex-theme",
      // v1: the default changed from Neon Cyber to Violet Night. The old default was saved for everyone who accepted
      // preference storage (whether or not they ever opened the picker), so a stored "neon-cyber" moves to the new
      // default once; every other choice is kept.
      version: 1,
      migrate: (persisted) => {
        const state = persisted as Partial<ThemeState> | undefined;
        return state?.style === "neon-cyber" ? { ...state, style: DEFAULT_STYLE } : (state as ThemeState);
      },
      storage: createJSONStorage(() => preferenceStorage),
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        if (state) writeStyleCookie(state.style);
        useTheme.setState({ hasHydrated: true });
      },
    }
  )
);
