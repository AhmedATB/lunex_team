"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AchievementsState {
  /** achievement id -> ISO timestamp it was unlocked at */
  unlocked: Record<string, string>;
  unlock: (id: string) => void;
}

export const useAchievements = create<AchievementsState>()(
  persist(
    (set, get) => ({
      unlocked: {},
      unlock: (id) => {
        if (get().unlocked[id]) return;
        set((s) => ({ unlocked: { ...s.unlocked, [id]: new Date().toISOString() } }));
      },
    }),
    { name: "lunex-achievements", skipHydration: true }
  )
);
