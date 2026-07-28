"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SessionState {
  currentUserId: string | null;
  isGuest: boolean;
  setCurrentUserId: (id: string | null) => void;
  logout: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      currentUserId: "user-1",
      isGuest: false,
      setCurrentUserId: (id) => set({ currentUserId: id, isGuest: id === null }),
      logout: () => set({ currentUserId: null, isGuest: true }),
    }),
    { name: "lunex-session", skipHydration: true }
  )
);
