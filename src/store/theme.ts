"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_STYLE, type StyleId } from "@/lib/theme-presets";
import type { AccentId } from "@/lib/accent-presets";

interface ThemeState {
  style: StyleId;
  /** null = use the active style's own built-in accent (today's behavior). Set to override just the accent on top of whichever style is active. */
  accent: AccentId | null;
  setStyle: (style: StyleId) => void;
  setAccent: (accent: AccentId | null) => void;
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      style: DEFAULT_STYLE,
      accent: null,
      setStyle: (style) => set({ style }),
      setAccent: (accent) => set({ accent }),
    }),
    { name: "lunex-theme", skipHydration: true }
  )
);
