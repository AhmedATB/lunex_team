"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Client-side only, deliberately — there's no push/email delivery backend yet, so this controls in-app UI only (e.g. whether the ticker/notification bell surfaces new-chapter alerts), not a promise of server-sent notifications. */
interface PreferencesState {
  newChapterAlerts: boolean;
  setNewChapterAlerts: (v: boolean) => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      newChapterAlerts: true,
      setNewChapterAlerts: (newChapterAlerts) => set({ newChapterAlerts }),
    }),
    { name: "lunex-preferences", skipHydration: true }
  )
);
